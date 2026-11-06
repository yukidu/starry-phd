import {SETTINGS,ATTRIBUTION,validateFix,recentFix,gridCell,neighborCells,cacheDecision,
 parseGeoapify,providerUrl} from './core.mjs';

// All Starry apps must call this Worker; no browser/client ever receives GEOAPIFY_API_KEY.
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',...headers}});
const error=(code,status)=>json({ok:false,code},status);
const asObj=(row)=>row?JSON.parse(row.payload):null;
const b64url=(part)=>{
 if(!/^[A-Za-z0-9_-]+$/.test(part))throw Error('INVALID_TOKEN');
 const raw=atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'='));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
let jwksCached=null;
async function verifyStarryToken(request,env){
 const authorization=request.headers.get('authorization')||'';
 const match=/^Bearer\s+([A-Za-z0-9._-]+)$/.exec(authorization);
 if(!match)throw Error('LOGIN_REQUIRED');
 const parts=match[1].split('.');if(parts.length!==3)throw Error('INVALID_TOKEN');
 let header,claims;
 try{header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));
   claims=JSON.parse(new TextDecoder().decode(b64url(parts[1])));}catch{throw Error('INVALID_TOKEN')}
 const allowed=(env.ALLOWED_APP_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(header.alg!=='ES256'||typeof header.kid!=='string'||header.kid.length>128||
  claims.iss!==env.STARRY_ISSUER||!allowed.includes(claims.app_id)||
  !(claims.aud==='starry'||Array.isArray(claims.aud)&&claims.aud.includes('starry'))||
  typeof claims.sub!=='string'||!claims.sub||!Number.isSafeInteger(claims.exp))throw Error('APP_SCOPE_DENIED');
 const time=Math.floor(Date.now()/1000);
 if(claims.exp<=time||claims.nbf>time||claims.iat>time+120)throw Error('TOKEN_EXPIRED');
 const base=new URL(env.STARRY_ID_BASE);
 if(base.protocol!=='https:'||base.username||base.password)throw Error('AUTH_CONFIG_INVALID');
 const upstream=(url,options)=>env.STARRY_ID_SERVICE?env.STARRY_ID_SERVICE.fetch(url,options):fetch(url,options);
 if(!jwksCached||jwksCached.expiresAt<Date.now()){
  const response=await upstream(new URL('/.well-known/jwks.json',base),{
   signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('CENTRAL_AUTH_UNAVAILABLE');
  const data=await response.json();if(!Array.isArray(data.keys))throw Error('CENTRAL_AUTH_INVALID');
  jwksCached={keys:data.keys,expiresAt:Date.now()+60000};
 }
 const jwk=jwksCached.keys.find(k=>k.kid===header.kid&&k.kty==='EC'&&k.crv==='P-256'&&(!k.alg||k.alg==='ES256'));
 if(!jwk)throw Error('BAD_SIGNER');
 const pub=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,b64url(parts[2]),
  new TextEncoder().encode(parts[0]+'.'+parts[1]));
 if(!ok)throw Error('BAD_SIGNATURE');
 // Central session state check prevents revoked/deleted/starry-id-disabled sessions being cached as valid.
 const me=await upstream(new URL('/v1/me',base),{
  headers:{authorization},signal:AbortSignal.timeout(8000)});
 if(!me.ok)throw Error('CENTRAL_SESSION_INVALID');
 const account=await me.json();
 const id=account.user_id??account.user?.user_id??account.user?.id;
 if(id!==claims.sub||account.user?.status&&account.user.status!=='active')throw Error('ACCOUNT_NOT_ACTIVE');
 return {appId:claims.app_id,subject:claims.sub};
}
const isAdmin=(subject,env)=>Boolean(subject)&&(env.LOCATION_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(subject);

export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname,origin=request.headers.get('origin');
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const headers=origin&&allowed.includes(origin)?{'access-control-allow-origin':origin,
   'access-control-allow-methods':'POST, GET, PUT, OPTIONS',
   'access-control-allow-headers':'authorization, content-type',
   'vary':'Origin'}:{};
  if(origin&&!allowed.includes(origin))return error('ORIGIN_DENIED',403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(path==='/health'&&request.method==='GET')return json({ok:true,service:'starry-location',providerEnabled:env.GEOAPIFY_ENABLED==='true'},200,headers);
  if(!path.startsWith('/v1/location/'))return error('NOT_FOUND',404);
  let principal;try{principal=await verifyStarryToken(request,env)}catch{return json({ok:false,code:'AUTH_DENIED'},401,headers)}
  const admin=path.startsWith('/v1/location/admin/');
  if(admin&&!isAdmin(principal.subject,env))return json({ok:false,code:'ADMIN_DENIED'},403,headers);
  if(!admin&&!(path==='/v1/location/reverse'&&request.method==='POST'))return error('NOT_FOUND',404);
  if(admin&&!((path==='/v1/location/admin/status'&&request.method==='GET')||
    (path==='/v1/location/admin/stop'&&request.method==='PUT')||
    (path==='/v1/location/admin/provider-reset'&&request.method==='PUT')) )return error('NOT_FOUND',404);
  let body=null;
  if(request.method==='POST'||request.method==='PUT'){
   if(Number(request.headers.get('content-length')||0)>2048)return error('PAYLOAD_TOO_LARGE',413);
   try{const text=await request.text();if(text.length>2048)throw Error();body=JSON.parse(text)}
   catch{return json({ok:false,code:'INVALID_JSON'},400,headers)}
  }
  if(!admin){
   if(body?.location_consent!==true)return json({ok:false,code:'CONSENT_REQUIRED'},403,headers);
   try{validateFix(body);if(!recentFix(body))throw Error('LOCATION_STALE_FIX')}
   catch{return json({ok:false,code:'LOCATION_INVALID_OR_STALE'},422,headers)}
  } else if(path.endsWith('/stop')){
   if(typeof body?.stopped!=='boolean'||body?.confirm!=='STOP_GEOAPIFY')return error('ADMIN_CONFIRM_REQUIRED',422);
  } else if(path.endsWith('/provider-reset')&&body?.confirm!=='RESET_GEOAPIFY_BLOCK'){
   return error('ADMIN_CONFIRM_REQUIRED',422);
  }
  // Durable Object is accessible only through the binding. No raw GPS or auth token stored in D1/DO logs.
  const coordinator=env.LOCATION_COORDINATOR;
  if(!coordinator)return json({ok:false,code:'COORDINATOR_UNAVAILABLE'},503,headers);
  const stub=coordinator.get(coordinator.idFromName('starry-location-global-v1'));
  const target=admin?(path.endsWith('/stop')?'/admin/stop':path.endsWith('/provider-reset')?'/admin/provider-reset':'/admin/status'):'/lookup';
  try{
   const result=await stub.fetch(new Request(`https://internal.invalid${target}`,{
    method:target==='/admin/status'?'GET':'POST',
    headers:{'content-type':'application/json'},
    body:target==='/admin/status'?undefined:JSON.stringify({
      ...(!admin?{lat:body.lat,lon:body.lon,accuracy_m:body.accuracy_m,captured_at_ms:body.captured_at_ms,
       force:body.force===true}:target==='/admin/stop'?{stopped:body.stopped}:{}),appId:principal.appId})}));
   return new Response(result.body,{status:result.status,headers:{...Object.fromEntries(result.headers),...headers,'cache-control':'private, no-store'}});
  }catch{return json({ok:false,code:'COORDINATOR_UNAVAILABLE'},503,headers)}
 }
};

export class LocationCoordinator {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.pending=new Map();this.counts=new Map();
  ctx.blockConcurrencyWhile(async()=>{
   const sql=ctx.storage.sql;
   sql.exec('CREATE TABLE IF NOT EXISTS cache (id INTEGER PRIMARY KEY,cell TEXT NOT NULL,payload TEXT NOT NULL,expires_at_ms INTEGER NOT NULL,negative INTEGER NOT NULL DEFAULT 0,queried_at_ms INTEGER NOT NULL)');
   sql.exec('CREATE INDEX IF NOT EXISTS idx_location_cell ON cache(cell)');
   sql.exec('CREATE INDEX IF NOT EXISTS idx_location_expiry ON cache(expires_at_ms)');
   sql.exec('CREATE TABLE IF NOT EXISTS spent (id INTEGER PRIMARY KEY,ts INTEGER NOT NULL,cost INTEGER NOT NULL,app_id TEXT NOT NULL)');
   sql.exec('CREATE INDEX IF NOT EXISTS idx_location_spent ON spent(ts)');
   sql.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
   sql.exec('CREATE TABLE IF NOT EXISTS counters (app_id TEXT NOT NULL,kind TEXT NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(app_id,kind))');
  });
 }
 sql(q,...args){return this.ctx.storage.sql.exec(q,...args)}
 one(q,...args){return this.sql(q,...args).toArray()[0]||null}
 state(key){return this.one('SELECT value FROM state WHERE key=?',key)?.value||''}
 count(app,kind){
  // Counts are combined in memory, then persisted in batches to reduce write traffic.
  const key=`${app}|${kind}`,next=(this.counts.get(key)||0)+1;
  if(next<20){this.counts.set(key,next);return}
  this.counts.delete(key);
  this.sql('INSERT INTO counters(app_id,kind,n) VALUES(?,?,?) ON CONFLICT(app_id,kind) DO UPDATE SET n=n+excluded.n',app,kind,next);
 }
 candidates(fix){
  const cells=neighborCells(fix);const p=cells.map(()=>'?').join(',');
  return this.sql(`SELECT payload,negative,expires_at_ms FROM cache WHERE cell IN (${p}) ORDER BY queried_at_ms DESC LIMIT ?`,...cells,SETTINGS.maxCandidates)
   .toArray().map(row=>{try{return {...asObj(row),negative:Boolean(row.negative)}}catch{return null}}).filter(Boolean);
 }
 summary(now){
  const used=this.one('SELECT COALESCE(SUM(cost),0) AS n FROM spent WHERE ts>?',now-86400000)?.n||0;
  return {credits_reserved_rolling24h:used,remaining_internal:Math.max(0,SETTINGS.maxCreditsRolling24h-used),
   internal_limit:SETTINGS.maxCreditsRolling24h,official_provider_usage:'unverified',
   stopped:this.state('stopped')==='true',providerBlocked:Boolean(this.state('provider_blocked')),
   counters:this.sql('SELECT app_id,kind,n FROM counters ORDER BY app_id,kind').toArray(),
   counters_accuracy:'approximate (up to 19 unflushed per category)',provider:'geoapify'};
 }
 async fetch(request){
  const url=new URL(request.url),now=Date.now();
  if(url.pathname==='/admin/status')return json(this.summary(now));
  let data;try{data=await request.json()}catch{return error('INVALID_JSON',400)}
  if(url.pathname==='/admin/provider-reset'){
   this.sql('DELETE FROM state WHERE key IN (?,?)','provider_blocked','retry_at');
   return json({ok:true,providerBlocked:false});
  }
  if(url.pathname==='/admin/stop'){
   if(typeof data.stopped!=='boolean')return error('INVALID_STOP',422);
   this.sql('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','stopped',String(data.stopped));
   // Provider 429/403 block has independent manual reset; switching off stop does not bypass it.
   return json({ok:true,stopped:data.stopped,providerBlocked:Boolean(this.state('provider_blocked'))});
  }
  if(url.pathname!=='/lookup')return error('NOT_FOUND',404);
  let fix;try{fix=validateFix(data);if(!recentFix(fix,now))throw Error();}catch{return error('INVALID_FIX',422)}
  const app=/^[a-z][a-z0-9-]{1,31}$/.test(data.appId||'')?data.appId:'unknown';
  const candidates=this.candidates(fix),decision=cacheDecision(candidates,fix,now);
  if(decision.status==='hit'&&data.force!==true){this.count(app,'central_hit');return json({ok:true,status:'fresh',cache:'central',...decision.entry});}
  const stale=decision.entry||null;
  if(decision.status==='negative'&&data.force!==true){this.count(app,'negative_hit');return json({ok:false,code:'LOCATION_UNAVAILABLE',cache:'negative'},404)}
  const temporarilyBlocked=Number(this.state('retry_at')||0)>now;
  const blocked=this.state('stopped')==='true'||this.state('provider_blocked')||temporarilyBlocked||this.env.GEOAPIFY_ENABLED!=='true'||!this.env.GEOAPIFY_API_KEY;
  if(blocked){this.count(app,'blocked');return stale?json({ok:true,status:'stale',cache:'central',...stale}):json({ok:false,code:temporarilyBlocked?'LOCATION_PROVIDER_BACKOFF':'LOCATION_PROVIDER_DISABLED',cache:'miss'},503)}
  const key=`${fix.lat.toFixed(6)}:${fix.lon.toFixed(6)}:zh`;
  if(this.pending.has(key)){
   this.count(app,'deduplicated');const result=await this.pending.get(key);
   return json({...result.body,cache:result.body.cache==='provider'?'deduplicated':result.body.cache},result.status);
  }
  // Promise is registered before the first outbound await. Serialized SQLite reservation occurs first.
  const task=this.lookupExternal(fix,app,stale,now);
  this.pending.set(key,task);
  try{const result=await task;return json(result.body,result.status)}
  finally{this.pending.delete(key)}
 }
 async lookupExternal(fix,app,stale,now){
  const used=this.one('SELECT COALESCE(SUM(cost),0) AS n FROM spent WHERE ts>?',now-86400000)?.n||0;
  const minute=this.one('SELECT COALESCE(SUM(cost),0) AS n FROM spent WHERE ts>?',now-60000)?.n||0;
  if(used+SETTINGS.reverseCredits>SETTINGS.maxCreditsRolling24h||minute>=20){
   this.count(app,'quota_blocked');return {status:used>=SETTINGS.maxCreditsRolling24h?429:503,
    body:stale?{ok:true,status:'stale',cache:'central',...stale}:
    {ok:false,code:used>=SETTINGS.maxCreditsRolling24h?'LOCATION_QUOTA_EXHAUSTED':'LOCATION_RATE_LIMITED',cache:'miss'}};
  }
  // Fail closed: every attempted external request consumes one reservation, including failures.
  this.sql('INSERT INTO spent(ts,cost,app_id) VALUES(?,?,?)',now,SETTINGS.reverseCredits,app);
  this.count(app,'external_reserved');
  if((this.one('SELECT COUNT(*) AS n FROM spent')?.n||0)>3000){
   this.sql('DELETE FROM spent WHERE ts<?',now-86400000);
  }
  let response;
  try{response=await fetch(providerUrl(fix,this.env.GEOAPIFY_API_KEY),{
   signal:AbortSignal.timeout(SETTINGS.providerTimeoutMs),headers:{accept:'application/json'}})}
  catch{this.sql('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','retry_at',String(now+60000));
   return {status:503,body:stale?{ok:true,status:'stale',cache:'central',...stale}:{ok:false,code:'LOCATION_PROVIDER_UNAVAILABLE'}}}
  if(response.status===429||response.status===401||response.status===403){
   this.sql('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','provider_blocked',String(response.status));
   return {status:503,body:stale?{ok:true,status:'stale',cache:'central',...stale}:{ok:false,code:'LOCATION_PROVIDER_BLOCKED'}};
  }
  if(!response.ok){
   this.sql('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','retry_at',String(now+60000));
   return {status:503,body:stale?{ok:true,status:'stale',cache:'central',...stale}:{ok:false,code:'LOCATION_PROVIDER_ERROR'}};
  }
  let data;try{data=await response.json()}catch{return {status:503,body:{ok:false,code:'LOCATION_PROVIDER_INVALID_RESPONSE'}}}
  const parsed=parseGeoapify(data,fix,now);
  const cell=gridCell(fix);
  if(!parsed){
   const negative={reference:fix,version:SETTINGS.version,negative:true,
    expires_at_ms:now+SETTINGS.negativeTtlMs,queried_at_ms:now};
   this.sql('INSERT INTO cache(cell,payload,expires_at_ms,negative,queried_at_ms) VALUES(?,?,?,?,?)',cell,JSON.stringify(negative),negative.expires_at_ms,1,now);
   return {status:404,body:{ok:false,code:'LOCATION_NOT_FOUND',cache:'provider'}};
  }
  this.sql('INSERT INTO cache(cell,payload,expires_at_ms,negative,queried_at_ms) VALUES(?,?,?,?,?)',cell,JSON.stringify(parsed),parsed.expires_at_ms,0,now);
  if((this.one('SELECT COUNT(*) AS n FROM cache')?.n||0)>SETTINGS.maxSharedRows){
   this.sql('DELETE FROM cache WHERE id IN (SELECT id FROM cache ORDER BY queried_at_ms ASC LIMIT 500)');
  }
  return {status:200,body:{ok:true,status:'fresh',cache:'provider',...parsed}};
 }
}
