import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const code=await fs.readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const token='A'.repeat(43);
const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
function dbs({centralDecision=null,centralStatus='active',memberStatus=null,createdAt=0}={}){
 const entries=new Map();
 const db={
   prepare(sql){return {bind(...args){return {
     async first(){
       if(sql.includes('FROM sessions'))return args[0]===hash?{user_id:'u-test'}:null;
       if(sql.includes('FROM entitlements'))return null;
       if(sql.includes('FROM media'))return null;
       return null;
     },
     async all(){
       if(sql.includes('FROM entries'))return {results:[...entries.values()]};
       return {results:[]};
     },
     async run(){
       if(sql.includes('INSERT INTO entries')){
         const [id,day,slot,body,updated_at]=args;
         entries.set(`${id}/${day}/${slot}`,{slot,body,updated_at});
       }
       return {success:true};
     }
   }}};
 }};
 const central={prepare(){return {bind(){return {first:async()=>({id:'u-test',status:centralStatus,createdAt,appDecision:centralDecision,memberStatus})}}}}};
 return {DB:db,STARRY_ID_DB:central,MEDIA:{get:async()=>null},ASSETS:{fetch:async()=>new Response('site')},GOOGLE_CLIENT_ID:'test-client'};
}
function req(path,method='GET',options={}){
 const headers=new Headers(options.headers||{});
 if(options.auth)headers.set('Cookie',`__Host-gratitude_session=${token}`);
 if(method!=='GET'&&method!=='HEAD'&&!headers.has('Origin'))headers.set('Origin','https://gratitude.starry.phd');
 return new Request('https://gratitude.starry.phd'+path,{method,headers,body:options.body});
}
test('Unauthenticated journal and media are never exposed',async()=>{
 const env=dbs();
 assert.equal((await worker.fetch(req('/api/entries?day=2026-10-23'),env)).status,401);
 assert.equal((await worker.fetch(req('/api/media/00000000-0000-0000-0000-000000000001'),env)).status,401);
});
test('Cross-origin writes are blocked',async()=>{
 const env=dbs();const r=await worker.fetch(req('/api/entries/2026-10-23/1','PUT',{auth:true,headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{"body":"test"}'}),env);
 assert.equal(r.status,403);
});
test('Invalid date and oversized text are rejected',async()=>{
 const env=dbs();
 assert.equal((await worker.fetch(req('/api/entries?day=2026-02-31','GET',{auth:true}),env)).status,400);
 assert.equal((await worker.fetch(req('/api/entries/2026-10-23/1','PUT',{auth:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({body:'字'.repeat(1501)})}),env)).status,400);
});
test('Verified member can save three independent items',async()=>{
 const env=dbs();
 for(let slot=1;slot<=3;slot++){
   const response=await worker.fetch(req(`/api/entries/2026-10-23/${slot}`,'PUT',{auth:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({body:`感恩 ${slot}`})}),env);
   assert.equal(response.status,200);
 }
 const r=await worker.fetch(req('/api/entries?day=2026-10-23','GET',{auth:true}),env);
 const j=await r.json();assert.equal(j.entries.length,3);
 assert.deepEqual(j.entries.map(x=>x.body),['感恩 1','感恩 2','感恩 3']);
});
test('No authentication bypass with random Starry ID ticket',async()=>{
 const env=dbs();const r=await worker.fetch(req('/api/auth/ticket','POST',{headers:{'Content-Type':'application/json'},body:'{"code":"not-a-ticket"}'}),env);
 assert.equal(r.status,401);
});
test('A healthy API never discloses private user data',async()=>{
 const env=dbs();const r=await worker.fetch(req('/api/health'),env);
 assert.deepEqual(await r.json(),{service:'gratitude-starry',status:'healthy'});
});

test('Central app-specific denial revokes an otherwise valid session',async()=>{
 const env=dbs({centralDecision:'deny'});
 const r=await worker.fetch(req('/api/entries?day=2026-10-23','GET',{auth:true}),env);
 assert.equal(r.status,401);
});
test('Suspended central accounts cannot read any journal',async()=>{
 const env=dbs({centralStatus:'suspended'});
 const r=await worker.fetch(req('/api/entries?day=2026-10-23','GET',{auth:true}),env);
 assert.equal(r.status,401);
});
test('New members require a central app grant',async()=>{
 const env=dbs({createdAt:Date.parse('2026-10-20T00:00:00Z')});
 const r=await worker.fetch(req('/api/entries?day=2026-10-23','GET',{auth:true}),env);
 assert.equal(r.status,401);
 const granted=dbs({createdAt:Date.parse('2026-10-20T00:00:00Z'),centralDecision:'allow'});
 assert.equal((await worker.fetch(req('/api/entries?day=2026-10-23','GET',{auth:true}),granted)).status,200);
});
test('Free-tier 1080p uploads are rejected by server even if the client lies',async()=>{
 const env=dbs();const image=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
 const r=await worker.fetch(req('/api/entries/2026-10-23/1/media','POST',{
  auth:true,headers:{'Content-Type':'image/png','X-Media-Width':'1920','X-Media-Height':'1080'},body:image
 }),env);
 assert.equal(r.status,400);
});
test('Free-tier videos exceeding 15 seconds are rejected',async()=>{
 const env=dbs();const sample=new Uint8Array([0x1a,0x45,0xdf,0xa3,0,0,0,0]);
 const r=await worker.fetch(req('/api/entries/2026-10-23/2/media','POST',{
  auth:true,headers:{'Content-Type':'video/webm','X-Media-Width':'640','X-Media-Height':'360','X-Media-Duration':'31'},body:sample
 }),env);
 assert.equal(r.status,400);
});
test('Invalid claimed media type is rejected before any storage write',async()=>{
 const env=dbs();const sample=new Uint8Array([0,1,2,3,4,5,6,7,8]);
 const r=await worker.fetch(req('/api/entries/2026-10-23/1/media','POST',{
  auth:true,headers:{'Content-Type':'image/png','X-Media-Width':'480','X-Media-Height':'480'},body:sample
 }),env);
 assert.equal(r.status,400);
});

function syntheticJpeg(width,height){
  return new Uint8Array([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,
    height>>8,height&255,width>>8,width&255,0x03,
    0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,0xff,0xd9]);
}
test('Image dimension headers cannot misrepresent encoded JPEG pixels',async()=>{
  const env=dbs();const payload=syntheticJpeg(1600,900);
  const r=await worker.fetch(req('/api/entries/2026-10-23/1/media','POST',{
    auth:true,headers:{'Content-Type':'image/jpeg','X-Media-Width':'640','X-Media-Height':'360'},body:payload
  }),env);
  assert.equal(r.status,400);
  assert.match((await r.json()).error,/尺寸/);
});
test('Truncated JPEG metadata is rejected before writing to storage',async()=>{
  const env=dbs();const bytes=new Uint8Array([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x01]);
  const r=await worker.fetch(req('/api/entries/2026-10-23/1/media','POST',{
    auth:true,headers:{'Content-Type':'image/jpeg','X-Media-Width':'640','X-Media-Height':'360'},body:bytes
  }),env);
  assert.equal(r.status,400);
});

test('Central one-time ticket creates private app-only session',async()=>{
  const env=dbs();let count=0;
  const original=env.STARRY_ID_DB.prepare;
  env.STARRY_ID_DB.prepare=(sql)=>sql.includes('DELETE FROM starry_app_auth_codes')
    ?{bind:()=>({first:async()=>++count===1?{userId:'u-test'}:null})}
    :original(sql);
  const options={auth:false,headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'B'.repeat(43)})};
  const first=await worker.fetch(req('/api/auth/ticket','POST',options),env);
  assert.equal(first.status,200);
  assert.match(first.headers.get('Set-Cookie')||'',/__Host-gratitude_session=/);
  assert.match(first.headers.get('Set-Cookie')||'',/HttpOnly/);
  const replay=await worker.fetch(req('/api/auth/ticket','POST',options),env);
  assert.equal(replay.status,401);
});
test('An unauthorized central account cannot exchange a valid ticket',async()=>{
  const env=dbs({centralDecision:'deny'});
  const original=env.STARRY_ID_DB.prepare;
  env.STARRY_ID_DB.prepare=(sql)=>sql.includes('DELETE FROM starry_app_auth_codes')
    ?{bind:()=>({first:async()=>({userId:'u-test'})})}
    :original(sql);
  const r=await worker.fetch(req('/api/auth/ticket','POST',{
    headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'C'.repeat(43)})
  }),env);
  assert.equal(r.status,403);
});
test('OAuth-style callback shell is never cacheable',async()=>{
  const r=await worker.fetch(req('/auth/callback?code=example'),dbs());
  assert.equal(r.status,200);
  assert.equal(r.headers.get('Cache-Control'),'no-store');
});
