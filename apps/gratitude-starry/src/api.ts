import type {Tier,Transcoded} from './media';
export type SavedEntry={slot:number,body:string,updated_at:number};
export type SavedMedia={id:string,slot:number,kind:'image'|'video',mime:string,bytes:number,width:number,height:number,duration_seconds:number};
export type DayResult={day:string,entries:SavedEntry[],media:SavedMedia[]};
export type Session={authenticated:boolean,tier:Tier};
const readJson=async (res:Response)=>{
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error((data as {error?:string}).error||'連線失敗，請稍後重試');return data;
};
export const api={
  session:()=>fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(readJson) as Promise<Session>,
  exchangeTicket:(code:string)=>fetch('/api/auth/ticket',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}).then(readJson),
  logout:()=>fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).then(readJson),
  day:(day:string)=>fetch(`/api/entries?day=${encodeURIComponent(day)}`,{cache:'no-store'}).then(readJson) as Promise<DayResult>,
  save:(day:string,slot:number,body:string)=>fetch(`/api/entries/${day}/${slot}`,{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({body})}).then(readJson),
  history:()=>fetch('/api/history',{cache:'no-store'}).then(readJson) as Promise<{history:Array<{day:string,filled:number}>}>,
  upload:(day:string,slot:number,media:Transcoded)=>fetch(`/api/entries/${day}/${slot}/media`,{
    method:'POST',headers:{'Content-Type':media.mime,'X-Media-Width':String(media.width),'X-Media-Height':String(media.height),'X-Media-Duration':String(media.duration)},body:media.file
  }).then(readJson) as Promise<SavedMedia>,
  deleteMedia:(id:string)=>fetch(`/api/media/${id}`,{method:'DELETE'}).then(readJson)
};
