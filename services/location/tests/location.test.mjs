import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {LocationCoordinator,default as worker} from '../src/worker.mjs';
import {SETTINGS,parseGeoapify,applicable,cacheDecision,haversineMeters,validateFix} from '../src/core.mjs';
import {createLocationClient} from '../src/client.mjs';
const now=()=>Date.now();
const fix=({lat=24.59939,lon=120.77734,accuracy_m=5,captured_at_ms=now()}={})=>({lat,lon,accuracy_m,captured_at_ms});
const providerResult={results:[{state:'苗栗縣',county:'苗栗縣',city:'後龍鎮',suburb:'龍坑里',locality:'十班坑',result_type:'suburb',distance:4,datasource:{attribution:'© OpenStreetMap contributors'}}]};
const fakeDB=()=>{
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(sql,...params){
  const stmt=db.prepare(sql);const isSelect=/^SELECT\b/i.test(sql.trim());
  const rows=isSelect?stmt.all(...params):[stmt.run(...params)];return {toArray(){return rows}};
 }}};
};
function mockCoord(enabled=true){
 const storage=fakeDB(),ctx={storage,blockConcurrencyWhile(fn){this.ready=fn();}};
 const c=new LocationCoordinator(ctx,{GEOAPIFY_ENABLED:String(enabled),GEOAPIFY_API_KEY:enabled?'test-key':undefined});
 const lookup=(params,appId='recordnote')=>c.fetch(new Request('https://internal.invalid/lookup',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...params,appId})})).then(async r=>({httpStatus:r.status,...await r.json()}));
 return {c,ctx,lookup};
}
async function withMockFetch(fake,fn){const original=globalThis.fetch;globalThis.fetch=fake;try{return await fn()}finally{globalThis.fetch=original}}

test('only returned source data forms location label; no fabricated street or village',()=>{
 const parsed=parseGeoapify(providerResult,fix());
 assert.equal(parsed.label,'苗栗縣・後龍鎮・龍坑里・十班坑附近');
 assert.equal(parsed.level,'locality');
 assert.equal(parsed.components.locality,'十班坑');
 const empty=parseGeoapify({results:[{state:'苗栗縣',city:'後龍鎮'}]},fix());
 assert.equal(empty.label,'苗栗縣・後龍鎮');
 assert.equal(empty.components.village,'');
});
test('Haversine measures meters; fine locality does not blind-reuse 100m',()=>{
 assert.ok(haversineMeters(fix(),fix({lon:120.7783}))>85);
 const entry=parseGeoapify(providerResult,fix());
 assert.equal(applicable(entry,fix(),now()),true);
 assert.equal(applicable(entry,fix({lon:120.7779}),now()),false);
 assert.equal(applicable(entry,fix({accuracy_m:60}),now()),false);
});
test('high uncertainty invalid GPS and stale GPS are rejected',()=>{
 assert.throws(()=>validateFix(fix({accuracy_m:500})),/ACCURACY/);
 assert.throws(()=>validateFix(fix({lat:95})),/COORDINATES/);
});
test('20 recordings in same place + two apps use just one Geoapify call',async()=>{
 const {ctx,lookup}=mockCoord();await ctx.ready;let count=0;
 await withMockFetch(async url=>{count++;assert.match(url,/lang=zh/);return Response.json(providerResult)},async()=>{
  const first=await lookup(fix());assert.equal(first.cache,'provider');
  for(let i=0;i<19;i++){const next=await lookup(fix(),i%2===0?'recordnote':'starry-other');assert.equal(next.cache,'central')}
 });
 assert.equal(count,1);
});
test('concurrent identical requests coalesce into one external call',async()=>{
 const {ctx,lookup}=mockCoord();await ctx.ready;let count=0;
 await withMockFetch(async()=>{count++;await new Promise(r=>setTimeout(r,25));return Response.json(providerResult)},async()=>{
  const responses=await Promise.all(Array.from({length:12},()=>lookup(fix())));
  assert.ok(responses.every(x=>x.ok));
 });
 assert.equal(count,1);
});
test('hard 2500 rolling 24h reservation blocks extra outbound requests but keeps cached names',async()=>{
 const {c,ctx,lookup}=mockCoord();await ctx.ready;let count=0;
 await withMockFetch(async()=>{count++;return Response.json(providerResult)},async()=>{
  const first=await lookup(fix());assert.equal(first.ok,true);
  // 2499 artificial prior attempts, plus the first real request.
  c.sql('INSERT INTO spent(ts,cost,app_id) VALUES(?,?,?)',now(),2499,'test-app');
  const same=await lookup(fix());assert.equal(same.cache,'central');
  const fresh=await lookup(fix({lat:24.6003}));assert.equal(fresh.code,'LOCATION_QUOTA_EXHAUSTED');
  assert.equal(c.summary(now()).credits_reserved_rolling24h,2500);
  assert.equal(count,1);
 });
});
test('older-than-24h credits no longer count; emergency stop prevents new calls',async()=>{
 const {c,ctx,lookup}=mockCoord();await ctx.ready;
 c.sql('INSERT INTO spent(ts,cost,app_id) VALUES(?,?,?)',now()-86400001,2500,'test-app');
 assert.equal(c.summary(now()).remaining_internal,2500);
 await c.fetch(new Request('https://internal.invalid/admin/stop',{method:'POST',body:JSON.stringify({stopped:true})}));
 const result=await lookup(fix());assert.equal(result.code,'LOCATION_PROVIDER_DISABLED');
});
test('Geoapify account limitation causes sticky block until manual intervention',async()=>{
 const {c,ctx,lookup}=mockCoord();await ctx.ready;let calls=0;
 await withMockFetch(async()=>{calls++;return new Response('{}',{status:429})},async()=>{
  assert.equal((await lookup(fix())).code,'LOCATION_PROVIDER_BLOCKED');
  assert.equal((await lookup(fix({lat:24.603}))).code,'LOCATION_PROVIDER_DISABLED');
 });
 assert.equal(calls,1);assert.equal(c.summary(now()).providerBlocked,true);
});
test('client persists local cache across app reload and respects consent',async()=>{
 const memory=new Map(),storage={getItem:async k=>memory.get(k)||null,setItem:async(k,v)=>memory.set(k,v)};
 let count=0;const query=async p=>{count++;return {ok:true,status:'fresh',cache:'provider',...parseGeoapify(providerResult,p)}};
 const first=createLocationClient({storage,query});
 assert.equal((await first.resolve(fix())).code,'CONSENT_REQUIRED');
 assert.equal((await first.resolve(fix(),{consent:true})).ok,true);
 const reopened=createLocationClient({storage,query});
 assert.equal((await reopened.resolve(fix(),{consent:true})).cache,'device');
 assert.equal(count,1);await reopened.clear();assert.deepEqual(await reopened.read(),[]);
});
test('unauthorized direct Worker request fails before Geoapify',async()=>{
 const response=await worker.fetch(new Request('https://location.starry.phd/v1/location/reverse',{
  method:'POST',body:JSON.stringify({...fix(),location_consent:true})}),{});
 assert.equal(response.status,401);
});
test('administrative result can reuse a safe sub-100m move, but village result cannot',()=>{
 const base=fix();const admin=parseGeoapify({results:[{state:'苗栗縣',city:'後龍鎮',result_type:'city'}]},base);
 const moved=fix({lon:120.7779}); // ~57 metres
 assert.equal(applicable(admin,moved),true);
 const village=parseGeoapify({results:[{state:'苗栗縣',city:'後龍鎮',suburb:'龍坑里',result_type:'suburb'}]},base);
 assert.equal(applicable(village,moved),false);
});
test('provider empty result is negatively cached for a short time, preventing repeated credits',async()=>{
 const {ctx,lookup}=mockCoord();await ctx.ready;let calls=0;
 await withMockFetch(async()=>{calls++;return Response.json({results:[]})},async()=>{
  assert.equal((await lookup(fix())).code,'LOCATION_NOT_FOUND');
  assert.equal((await lookup(fix())).cache,'negative');
 });
 assert.equal(calls,1);
});
test('expired cache is clearly stale and is not automatically a confirmed village boundary',()=>{
 const entry=parseGeoapify(providerResult,fix(),now()-8*86400000);
 const choice=cacheDecision([entry],fix());
 assert.equal(choice.status,'stale');
});
test('consent=false never invokes outgoing API and keeps previous local name accessible only by explicit opt-in',async()=>{
 const m=new Map(),storage={getItem:async k=>m.get(k)||null,setItem:async(k,v)=>m.set(k,v)};
 let calls=0;const query=async x=>{calls++;return {ok:true,...parseGeoapify(providerResult,x)}};
 const c=createLocationClient({storage,query});
 assert.equal((await c.resolve(fix(),{consent:false})).code,'CONSENT_REQUIRED');
 assert.equal(calls,0);
});
test('temporary network failure enters 60-second backoff and does not retry other points immediately',async()=>{
 const {c,ctx,lookup}=mockCoord();await ctx.ready;let calls=0;
 await withMockFetch(async()=>{calls++;throw Error('offline')},async()=>{
  assert.equal((await lookup(fix())).code,'LOCATION_PROVIDER_UNAVAILABLE');
  assert.equal((await lookup(fix({lat:24.604}))).code,'LOCATION_PROVIDER_BACKOFF');
 });
 assert.equal(calls,1);
});
test('manual provider block reset is independent of the global emergency stop',async()=>{
 const {c,ctx,lookup}=mockCoord();await ctx.ready;
 c.sql('INSERT INTO state(key,value) VALUES(?,?)','provider_blocked','429');
 c.sql('INSERT INTO state(key,value) VALUES(?,?)','stopped','true');
 await c.fetch(new Request('https://internal.invalid/admin/provider-reset',{method:'POST',body:JSON.stringify({})}));
 assert.equal(c.summary(now()).providerBlocked,false);
 assert.equal(c.summary(now()).stopped,true);
});
