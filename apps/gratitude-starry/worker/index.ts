/** Gratitude Starry API. Independent D1/R2; central D1 used exclusively for identity verification. */
import type { ExportedHandler, D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  STARRY_ID_DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
}
type Identity = { id: string; tier: 'free' | 'pro' };
type MediaRow = { id:string; user_id:string; storage_key:string; kind:string; mime:string; bytes:number; width:number; height:number; duration_seconds:number; day:string; slot:number };
const COOKIE = '__Host-gratitude_session';
const CENTRAL_APP_ID = 'gratitude-starry';
const NEW_MEMBER_GRANT_CUTOFF = Date.parse('2026-10-18T16:30:14.903Z');
const WEEK = 7 * 86400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,}$/;
const MAX_TEXT = 1500;
const MAX_JSON_BYTES = 12000;
const mimeSet = new Set(['image/jpeg','image/png','image/webp','video/webm','video/mp4']);

const security: Record<string,string> = {
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer', 'Cross-Origin-Resource-Policy':'same-origin', 'Permissions-Policy':'camera=(),geolocation=()'
};
const response = (value:unknown,status=200,additional:Record<string,string>={})=>
  new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json;charset=UTF-8',...security,...additional}});
function deny(status:number, message:string){return response({error:message},status)}
function sameOrigin(req:Request){ const origin=req.headers.get('Origin');return !!origin && origin===new URL(req.url).origin; }
function parseCookies(req:Request){
  const raw=req.headers.get('Cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('='); if(i<0) continue;
    if(part.slice(0,i).trim()===COOKIE){const value=part.slice(i+1).trim();return TOKEN_RE.test(value)?value:''}
  }
  return '';
}
function base64Url(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomToken(){const data=new Uint8Array(32);crypto.getRandomValues(data);return base64Url(data)}
async function hash(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
/** Central authorization is checked for every request, not just at sign in.
 * Revoked accounts and app-specific deny decisions cannot retain diary access.
 */
async function authorizedCentralMember(env:Env,userId:string):Promise<boolean>{
  const row=await env.STARRY_ID_DB.prepare(`SELECT u.id,u.status,u.createdAt,
       a.decision AS appDecision,m.status AS memberStatus
    FROM users u
    LEFT JOIN starry_app_access_decisions a ON a.userId=u.id AND a.appId=?
    LEFT JOIN app_memberships m ON m.userId=u.id AND m.appId=?
    WHERE u.id=? LIMIT 1`)
    .bind(CENTRAL_APP_ID,CENTRAL_APP_ID,userId)
    .first<{id:string,status:string,createdAt:number|string,appDecision?:string,memberStatus?:string}>();
  if(!row||row.status!=='active'||row.appDecision==='deny'||(row.memberStatus&&row.memberStatus!=='active'))return false;
  if(row.appDecision==='allow')return true;
  const createdAt=Number(row.createdAt);
  return !Number.isFinite(createdAt)||createdAt<NEW_MEMBER_GRANT_CUTOFF;
}
async function current(req:Request,env:Env):Promise<Identity|null>{
  const token=parseCookies(req);if(!token)return null;
  const row=await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>? LIMIT 1').bind(await hash(token),Date.now()).first<{user_id:string}>();
  if(!row?.user_id)return null;
  if(!await authorizedCentralMember(env,row.user_id))return null;
  const ent=await env.DB.prepare('SELECT tier FROM entitlements WHERE user_id=? LIMIT 1').bind(row.user_id).first<{tier:string}>();
  return {id:row.user_id,tier:ent?.tier==='pro'?'pro':'free'};
}
async function jsonBody(req:Request){
  if(Number(req.headers.get('Content-Length')||0)>MAX_JSON_BYTES)throw Error('too_large');
  const data=await req.text();if(data.length>MAX_JSON_BYTES)throw Error('too_large');
  return JSON.parse(data) as Record<string,unknown>;
}
function validDay(v:string){if(!DATE_RE.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
function keyKind(mime:string){return mime.startsWith('image/')?'image':'video'}
function limit(tier:Identity['tier'],kind:'image'|'video'){
  const pro=tier==='pro';return {pixels:pro?1080:480,seconds:pro?30:15,bytes:kind==='image'?(pro?5_000_000:2_000_000):(pro?30_000_000:12_000_000),total:pro?2_000_000_000:200_000_000};
}
function correctMime(b:Uint8Array,mime:string){
  if(mime==='image/jpeg')return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
  if(mime==='image/webp')return new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP';
  if(mime==='video/webm')return [0x1a,0x45,0xdf,0xa3].every((v,i)=>b[i]===v);
  if(mime==='video/mp4')return new TextDecoder().decode(b.slice(4,8))==='ftyp';
  return false;
}
/** Extract dimensions from the encoded JPEG itself; request headers are never proof of pixel count. */
function jpegDimensions(bytes: Uint8Array): {width:number;height:number}|null {
  if(bytes.length<10||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  let offset=2;
  while(offset+4<=bytes.length){
    if(bytes[offset]!==0xff)return null;
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    if(offset>=bytes.length)return null;
    const marker=bytes[offset++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>bytes.length)return null;
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length)return null;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      if(length<7)return null;
      const height=(bytes[offset+3]<<8)|bytes[offset+4];
      const width=(bytes[offset+5]<<8)|bytes[offset+6];
      return width>0&&height>0?{width,height}:null;
    }
    offset+=length;
  }
  return null;
}

/** Verify encoded video container metadata on the server instead of trusting browser headers.
 * WebM derives timing from Info.Duration or cluster block timestamps; MP4 requires
 * moov movie timing plus a video track's dimensions. Malformed/fragmented input
 * fails closed. This is metadata validation, NOT a replacement for a video
 * transcoding service before real-money premium video is enabled.
 */
function inspectVideo(bytes: Uint8Array, mime: string): {width:number;height:number;duration:number}|null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u8 = (pos:number) => bytes[pos];
  const u16 = (pos:number) => dv.getUint16(pos);
  const u32 = (pos:number) => dv.getUint32(pos);
  const fourcc = (pos:number) => String.fromCharCode(...bytes.subarray(pos,pos+4));
  if (mime === 'video/mp4') {
    if(bytes.length<24 || fourcc(4)!=='ftyp') return null;
    type Box = {name:string;start:number;end:number};
    function boxes(start:number,end:number):Box[]|null {
      const result:Box[]=[];let pos=start;
      while(pos+8<=end){
        const size=u32(pos),name=fourcc(pos+4);let begin=pos+8,boxEnd=pos+size;
        if(size===1){
          if(pos+16>end) return null;
          const high=u32(pos+8),low=u32(pos+12);
          const total=high*4294967296+low;
          if(!Number.isSafeInteger(total)) return null;
          begin=pos+16;boxEnd=pos+total;
        } else if(size===0)boxEnd=end;
        if(boxEnd<begin||boxEnd>end)return null;
        result.push({name,start:begin,end:boxEnd});pos=boxEnd;
      }
      return pos===end?result:null;
    }
    const top=boxes(0,bytes.length);if(!top)return null;
    const moov=top.find(b=>b.name==='moov');if(!moov)return null;
    const moovBoxes=boxes(moov.start,moov.end);if(!moovBoxes)return null;
    const mvhd=moovBoxes.find(b=>b.name==='mvhd');if(!mvhd)return null;
    const version=u8(mvhd.start);
    if(version!==0&&version!==1)return null;
    const timeOffset=version===0?12:20;
    const durationOffset=version===0?16:24;
    if(mvhd.end<mvhd.start+durationOffset+(version===0?4:8))return null;
    const timescale=u32(mvhd.start+timeOffset);
    const durationTicks=version===0?u32(mvhd.start+durationOffset):u32(mvhd.start+durationOffset)*4294967296+u32(mvhd.start+durationOffset+4);
    const duration=durationTicks/timescale;
    if(!Number.isFinite(duration)||duration<=0)return null;
    let width=0,height=0;
    for(const trak of moovBoxes.filter(b=>b.name==='trak')){
      const trakBoxes=boxes(trak.start,trak.end);if(!trakBoxes) return null;
      const mdia=trakBoxes.find(b=>b.name==='mdia');
      if(!mdia)continue;
      const mdiaBoxes=boxes(mdia.start,mdia.end);if(!mdiaBoxes)return null;
      const hdlr=mdiaBoxes.find(b=>b.name==='hdlr');
      if(!hdlr||hdlr.start+12>hdlr.end||fourcc(hdlr.start+8)!=='vide')continue;
      const tkhd=trakBoxes.find(b=>b.name==='tkhd');if(!tkhd)return null;
      const tkVersion=u8(tkhd.start);if(tkVersion!==0&&tkVersion!==1)return null;
      const wOffset=tkVersion===0?76:88;
      if(tkhd.start+wOffset+8>tkhd.end)return null;
      const w=u32(tkhd.start+wOffset)/65536,h=u32(tkhd.start+wOffset+4)/65536;
      if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)return null;
      width=Math.max(width,w);height=Math.max(height,h);
    }
    return width>0&&height>0?{width,height,duration}:null;
  }
  if(mime!=='video/webm'||bytes.length<12||u32(0)!==0x1a45dfa3)return null;
  // EBML variable-length integer: IDs retain the leading length bit,
  // whereas sizes discard it. The all-ones size denotes an unknown Segment length.
  function vint(pos:number,sizeMode:boolean):{value:number,length:number,unknown:boolean}|null{
    if(pos>=bytes.length)return null;
    const first=bytes[pos];if(!first)return null;
    let count=1;while(count<=8&&(first&(0x80>>(count-1)))===0)count++;
    if(count>8||pos+count>bytes.length)return null;
    let val=sizeMode?(first&((1<<(8-count))-1)):first;
    for(let i=1;i<count;i++)val=val*256+bytes[pos+i];
    const unknown=sizeMode && (first&((1<<(8-count))-1))===((1<<(8-count))-1) && bytes.subarray(pos+1,pos+count).every(x=>x===0xff);
    return unknown?{value:0,length:count,unknown:true}:Number.isSafeInteger(val)?{value:val,length:count,unknown:false}:null;
  }
  const segmentId=0x18538067, infoId=0x1549a966, tracksId=0x1654ae6b,
    entryId=0xae,videoId=0xe0,clusterId=0x1f43b675,groupId=0xa0;
  const nested=new Set([segmentId,infoId,tracksId,entryId,videoId,clusterId,groupId]);
  let duration=0,scale=1_000_000,videoWidth=0,videoHeight=0,lastTicks=0,clusterTicks=0,trackType=0;
  let widthSeen=0,heightSeen=0,hasSegment=false,videoEntries=0;
  let nodes=0;
  function uint(pos:number,len:number){if(len<1||len>6)return NaN;let v=0;for(let i=0;i<len;i++)v=v*256+bytes[pos+i];return v}
  function walk(start:number,end:number,depth:number):boolean{
    if(depth>9)return false;
    let pos=start;
    while(pos<end){
      if(++nodes>150000)return false;
      const id=vint(pos,false);if(!id)return false;
      const size=vint(pos+id.length,true);if(!size)return false;
      const dataStart=pos+id.length+size.length;
      const dataEnd=size.unknown?end:dataStart+size.value;
      if(dataEnd>end||dataEnd<dataStart)return false;
      const n=dataEnd-dataStart;
      if(id.value===segmentId)hasSegment=true;
      if(id.value===0x2ad7b1){const v=uint(dataStart,n);if(!Number.isFinite(v)||v<=0)return false;scale=v}
      if(id.value===0x4489){if(n===4)duration=dv.getFloat32(dataStart);else if(n===8)duration=dv.getFloat64(dataStart);else return false}
      if(id.value===0x83)trackType=uint(dataStart,n);
      if(id.value===0xb0)widthSeen=uint(dataStart,n);
      if(id.value===0xba)heightSeen=uint(dataStart,n);
      if(id.value===0xe7)clusterTicks=uint(dataStart,n);
      if(id.value===0xa3||id.value===0xa1){
        const track=vint(dataStart,true);
        if(track&&n>=track.length+3){
          const rel=dv.getInt16(dataStart+track.length);
          lastTicks=Math.max(lastTicks,clusterTicks+rel);
        }
      }
      if(id.value===entryId){trackType=0;widthSeen=0;heightSeen=0}
      if(nested.has(id.value)&&!walk(dataStart,dataEnd,depth+1))return false;
      if(id.value===entryId&&trackType===1){
        if(!Number.isSafeInteger(widthSeen)||!Number.isSafeInteger(heightSeen)||widthSeen<1||heightSeen<1)return false;
        videoEntries++;
        videoWidth=Math.max(videoWidth,widthSeen);videoHeight=Math.max(videoHeight,heightSeen);
      }
      pos=dataEnd;
    }
    return pos===end;
  }
  if(!walk(0,bytes.length,0)||!hasSegment||videoEntries===0)return null;
  const measured=Math.max(duration,lastTicks+2)*scale/1_000_000_000;
  return Number.isFinite(measured)&&measured>0?{width:videoWidth,height:videoHeight,duration:measured}:null;
}

/** Read upload streams within an explicit bound. Browsers may omit Content-Length. */
async function boundedBytes(req:Request,maxBytes:number):Promise<Uint8Array>{
  if(!req.body)throw Error('empty_media');
  const reader=req.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){await reader.cancel().catch(()=>undefined);throw Error('oversized_media')}
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  if(total===0)throw Error('empty_media');
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return bytes;
}
/** Exchange a one-time Starry ID ticket for an app-only HttpOnly session. */
async function exchangeTicket(req:Request,env:Env){
  let body:Record<string,unknown>;
  try{body=await jsonBody(req)}catch{return deny(400,'登入資料格式不正確')}
  const code=typeof body.code==='string'?body.code:'';
  if(!TOKEN_RE.test(code))return deny(401,'登入憑證無效，請重新登入');
  const claimed=await env.STARRY_ID_DB.prepare(`DELETE FROM starry_app_auth_codes
    WHERE codeHash=? AND appId=? AND expiresAt>?
    RETURNING userId`).bind(await hash(code),CENTRAL_APP_ID,Date.now()).first<{userId:string}>();
  if(!claimed?.userId)return deny(401,'登入憑證已使用或過期');
  if(!await authorizedCentralMember(env,claimed.userId))return deny(403,'尚未取得繁星感恩日記的會員使用資格');
  const token=randomToken(),now=Date.now();
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(await hash(token),claimed.userId,now+WEEK,now).run();
  return response({authenticated:true},200,{'Set-Cookie':`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${WEEK/1000}`});
}
async function listEntries(userId:string,day:string,env:Env){
  const entries=await env.DB.prepare('SELECT slot,body,updated_at FROM entries WHERE user_id=? AND day=? ORDER BY slot').bind(userId,day).all();
  const media=await env.DB.prepare('SELECT id,slot,kind,mime,bytes,width,height,duration_seconds FROM media WHERE user_id=? AND day=?').bind(userId,day).all();
  return response({day,entries:entries.results,media:media.results});
}
async function putEntry(req:Request,env:Env,user:Identity,day:string,slot:number){
  let input:Record<string,unknown>;try{input=await jsonBody(req)}catch{return deny(400,'日記資料格式錯誤')}
  if(typeof input.body!=='string'||input.body.length>MAX_TEXT)return deny(400,'每件感恩限 1500 字');
  await env.DB.prepare(`INSERT INTO entries(user_id,day,slot,body,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,day,slot) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`)
    .bind(user.id,day,slot,input.body,Date.now()).run();
  return response({saved:true});
}
async function history(env:Env,user:Identity,page:number){
  const records=await env.DB.prepare(`SELECT day,COUNT(*) AS filled,MAX(updated_at) AS updated FROM entries
    WHERE user_id=? AND LENGTH(TRIM(body))>0 GROUP BY day ORDER BY day DESC LIMIT 30 OFFSET ?`).bind(user.id,page*30).all();
  return response({history:records.results});
}
async function putMedia(req:Request,env:Env,user:Identity,day:string,slot:number){
  const mime=(req.headers.get('Content-Type')||'').split(';')[0].toLowerCase(),kind=keyKind(mime);
  if(!mimeSet.has(mime))return deny(415,'只接受 JPEG、PNG、WebP、WebM 或 MP4');
  const policy=limit(user.tier,kind);
  const declared=req.headers.get('Content-Length');
  const len=declared===null?null:Number(declared);
  if(len!==null&&(!Number.isSafeInteger(len)||len<=0||len>policy.bytes))return deny(413,'影像超過會員方案限制');
  const width=Number(req.headers.get('X-Media-Width')||0),height=Number(req.headers.get('X-Media-Height')||0),duration=Number(req.headers.get('X-Media-Duration')||0);
  const portrait=height>width,maxW=portrait?policy.pixels:Math.round(policy.pixels*16/9),maxH=portrait?Math.round(policy.pixels*16/9):policy.pixels;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>maxW||height>maxH||!Number.isFinite(duration)||duration<0||(kind==='video'&&(duration<1||duration>policy.seconds)))return deny(400,'影像尺寸或長度不符合方案');
  let bytes:Uint8Array;
  try{bytes=await boundedBytes(req,policy.bytes)}catch(e){return deny(e instanceof Error&&e.message==='oversized_media'?413:400,'影像大小或內容無效')}
  if((len!==null&&bytes.byteLength!==len)||!correctMime(bytes,mime))return deny(400,'影像內容無效');
  // Canvas uploads use JPEG. Validate true encoded dimensions instead of trusting
  // X-Media-* claims (which a modified client could otherwise spoof).
  if(kind==='image'){
    if(mime!=='image/jpeg')return deny(415,'請使用應用程式自動壓縮後的 JPEG 照片');
    const decoded=jpegDimensions(bytes);
    if(!decoded||decoded.width!==width||decoded.height!==height)return deny(400,'照片的實際尺寸與申報不符');
  }
  if(kind==='video'){
    const examined=inspectVideo(bytes,mime);
    if(!examined||examined.width!==width||examined.height!==height||examined.duration>policy.seconds+0.25||Math.abs(examined.duration-duration)>1.25)
      return deny(400,'影片實際尺寸或長度不符合會員方案');
  }
  // Before enabling real-money subscriptions, video may require full provider-
  // side transcoding; client-side MediaRecorder is not a billing trust boundary.
  const used=await env.DB.prepare('SELECT COALESCE(SUM(bytes),0) AS total FROM media WHERE user_id=?').bind(user.id).first<{total:number}>();
  const old=await env.DB.prepare('SELECT id,storage_key,bytes FROM media WHERE user_id=? AND day=? AND slot=?').bind(user.id,day,slot).first<{id:string,storage_key:string,bytes:number}>();
  if(Number(used?.total||0)-(old?.bytes||0)+bytes.length>policy.total)return deny(413,'個人儲存空間已滿');
  const id=crypto.randomUUID();const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/webp'?'webp':mime==='video/mp4'?'mp4':'webm';
  const storageKey=`u/${encodeURIComponent(user.id)}/${day}/${slot}/${id}.${ext}`;
  await env.MEDIA.put(storageKey,bytes,{httpMetadata:{contentType:mime}});
  try{
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO entries(user_id,day,slot,body,updated_at) VALUES(?,?,?,'',?) ON CONFLICT DO NOTHING`).bind(user.id,day,slot,now),
      env.DB.prepare(`INSERT INTO media(id,user_id,day,slot,kind,mime,bytes,width,height,duration_seconds,storage_key,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,day,slot) DO UPDATE SET
      id=excluded.id,kind=excluded.kind,mime=excluded.mime,bytes=excluded.bytes,width=excluded.width,height=excluded.height,
      duration_seconds=excluded.duration_seconds,storage_key=excluded.storage_key,created_at=excluded.created_at`)
       .bind(id,user.id,day,slot,kind,mime,bytes.length,width,height,Math.round(duration),storageKey,now)
    ]);
  }catch(e){await env.MEDIA.delete(storageKey);throw e}
  if(old?.storage_key)await env.MEDIA.delete(old.storage_key).catch(()=>undefined);
  return response({id,kind,mime,bytes:bytes.length,width,height,duration_seconds:duration});
}
async function mediaFile(req:Request,env:Env,user:Identity,id:string){
  const row=await env.DB.prepare('SELECT * FROM media WHERE id=? AND user_id=? LIMIT 1').bind(id,user.id).first<MediaRow>();
  if(!row)return deny(404,'找不到影像');
  const range=req.headers.get('Range');
  const obj=await env.MEDIA.get(row.storage_key,range?{range:req.headers}:{}) as R2ObjectBody | null;
  if(!obj)return deny(404,'影像不存在');
  const h=new Headers({'Content-Type':row.mime,'Cache-Control':'private,no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Cross-Origin-Resource-Policy':'same-origin'});
  const resultRange=obj.range as {offset?:number,length?:number}|undefined;
  if(range&&resultRange?.offset!==undefined&&resultRange.length!==undefined){h.set('Content-Range',`bytes ${resultRange.offset}-${resultRange.offset+resultRange.length-1}/${obj.size}`);h.set('Content-Length',String(resultRange.length));return new Response(req.method==='HEAD'?null:obj.body,{status:206,headers:h});}
  h.set('Content-Length',String(obj.size));return new Response(req.method==='HEAD'?null:obj.body,{headers:h});
}
async function deleteMedia(env:Env,user:Identity,id:string){
  const row=await env.DB.prepare('SELECT storage_key FROM media WHERE id=? AND user_id=?').bind(id,user.id).first<{storage_key:string}>();
  if(!row)return deny(404,'影像不存在');
  await env.DB.prepare('DELETE FROM media WHERE id=? AND user_id=?').bind(id,user.id).run();
  await env.MEDIA.delete(row.storage_key);
  return response({deleted:true});
}
const worker:ExportedHandler<Env>={
  async fetch(req,env){
    const u=new URL(req.url),path=u.pathname,method=req.method.toUpperCase();
    if(path==='/auth/callback'&&method==='GET'){
      const shell=new URL(req.url);shell.pathname='/';shell.search='';
      const page=await env.ASSETS.fetch(new Request(shell.toString(),req));
      const headers=new Headers(page.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');
      return new Response(page.body,{status:page.status,headers});
    }
    if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
    if(!['GET','POST','PUT','DELETE','HEAD'].includes(method))return deny(405,'不支援此操作');
    if(!['GET','HEAD'].includes(method)&&!sameOrigin(req))return deny(403,'請從應用程式操作');
    try{
      if(path==='/api/health'&&method==='GET')return response({service:'gratitude-starry',status:'healthy'});
      if(path==='/api/auth/ticket'&&method==='POST')return exchangeTicket(req,env);
      const user=await current(req,env);
      if(path==='/api/session'&&method==='GET')return response({authenticated:!!user,tier:user?.tier||'free'});
      if(path==='/api/auth/logout'&&method==='POST'){
        const token=parseCookies(req);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();
        return response({authenticated:false},200,{'Set-Cookie':`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`});
      }
      if(!user)return deny(401,'請先登入繁星通行證');
      if(path==='/api/entries'&&method==='GET'){
        const day=u.searchParams.get('day')||'';if(!validDay(day))return deny(400,'日期格式錯誤');return listEntries(user.id,day,env);
      }
      if(path==='/api/history'&&method==='GET'){
        const page=Number(u.searchParams.get('page')||0);if(!Number.isSafeInteger(page)||page<0||page>1000)return deny(400,'頁數錯誤');return history(env,user,page);
      }
      const entry=path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})\/([123])$/);
      if(entry&&method==='PUT'){
        if(!validDay(entry[1]))return deny(400,'日期錯誤');return putEntry(req,env,user,entry[1],Number(entry[2]));
      }
      const attach=path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})\/([123])\/media$/);
      if(attach&&method==='POST'){
        if(!validDay(attach[1]))return deny(400,'日期錯誤');return putMedia(req,env,user,attach[1],Number(attach[2]));
      }
      const media=path.match(/^\/api\/media\/([a-f0-9-]{36})$/i);
      if(media&&['GET','HEAD'].includes(method))return mediaFile(req,env,user,media[1]);
      if(media&&method==='DELETE')return deleteMedia(env,user,media[1]);
      return deny(404,'找不到功能');
    }catch(e){console.error(JSON.stringify({event:'api_error',path,category:e instanceof Error?e.name:'unknown'}));return deny(500,'系統忙碌，請稍後再試');}
  }
};
export default worker;