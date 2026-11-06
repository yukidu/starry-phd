/** Explicit on-demand client; never performs geolocation/watchPosition by itself.
 * storage: AsyncStorage-compatible getItem/setItem; web can use indexedDB adapter.
 * Each app supplies its own consent and obtained GPS fix.
 */
import {SETTINGS,validateFix,recentFix,cacheDecision} from './core.mjs';
export const LOCAL_STORAGE_KEY='starry.location.v1';
export function createLocationClient({storage,query,clock=()=>Date.now(),maxEntries=200}){
 if(!storage?.getItem||!storage?.setItem||typeof query!=='function')throw Error('LOCATION_CLIENT_CONFIG_INVALID');
 const pending=new Map();let lastQuery=0;
 async function read(){
  try{const stored=JSON.parse(await storage.getItem(LOCAL_STORAGE_KEY)||'[]');return Array.isArray(stored)?stored.slice(0,maxEntries):[]}
  catch{return []}
 }
 async function put(rows){
  // Local stores must not contain identity or account activity trails.
  const unique=[],seen=new Set();
  for(const row of rows){if(!row?.reference||!row?.label)continue;
   const key=`${row.reference.lat.toFixed(6)}:${row.reference.lon.toFixed(6)}:${row.level}`;
   if(seen.has(key))continue;seen.add(key);unique.push(row);
   if(unique.length>=maxEntries)break;
  }
  await storage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(unique));
 }
 async function clear(){await storage.setItem(LOCAL_STORAGE_KEY,'[]')}
 async function resolve(fix,{consent=false,refresh=false}={}){
  if(!consent)return {ok:false,code:'CONSENT_REQUIRED'};
  try{validateFix(fix);if(!recentFix(fix,clock()))throw Error('STALE_FIX')}
  catch{return {ok:false,code:'LOCATION_INVALID_OR_STALE'}}
  const rows=await read(),decision=cacheDecision(rows,fix,clock());
  if(decision.status==='hit'&&!refresh)return {...decision.entry,ok:true,status:'fresh',cache:'device'};
  const key=`${fix.lat.toFixed(6)}:${fix.lon.toFixed(6)}:${refresh}`;
  if(pending.has(key))return pending.get(key);
  // 8s debounce applies only to outbound network; valid local cache remains immediately available.
  if(!refresh&&clock()-lastQuery<8000){
   return decision.entry?{...decision.entry,ok:true,status:'stale',cache:'device'}:
    {ok:false,code:'LOCATION_DEBOUNCED'};
  }
  lastQuery=clock();
  const task=(async()=>{
   let answer;
   try{answer=await query({...fix,location_consent:true,force:refresh})}
   catch{return decision.entry?{...decision.entry,ok:true,status:'stale',cache:'device'}:
      {ok:false,code:'LOCATION_TEMPORARILY_UNAVAILABLE'}}
   if(answer?.ok&&answer.label&&answer.reference){
    await put([answer,...rows]);return answer;
   }
   return decision.entry?{...decision.entry,ok:true,status:'stale',cache:'device'}:
    {ok:false,code:answer?.code||'LOCATION_TEMPORARILY_UNAVAILABLE'};
  })();
  pending.set(key,task);try{return await task}finally{pending.delete(key)}
 }
 return {resolve,read,clear};
}

/** On web, this IndexedDB adapter persists across reloads and closing the browser. */
export function browserIndexedDbAdapter({name='starry-location-local-v1'}={}){
 if(typeof indexedDB==='undefined')throw Error('INDEXED_DB_UNAVAILABLE');
 const db=new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('cache');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
 const operate=async(mode,key,value)=>{
  const database=await db;
  return new Promise((resolve,reject)=>{
   const tx=database.transaction('cache',mode),store=tx.objectStore('cache');
   const req=mode==='readonly'?store.get(key):store.put(value,key);
   req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);
  });
 };
 return {getItem:key=>operate('readonly',key),setItem:(key,val)=>operate('readwrite',key,val)};
}
