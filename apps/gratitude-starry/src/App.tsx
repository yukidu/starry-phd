import {useCallback,useEffect,useRef,useState} from 'react';
import {api,type Session,type SavedMedia} from './api';
import {compressImage,compressVideo,type Tier} from './media';
import {makeCard} from './card';

type Draft = {text:string,media:SavedMedia|null,localURL:string|null,localKind:'image'|'video'|null};
const empty=():Draft=>({text:'',media:null,localURL:null,localKind:null});
const labels=['感恩第一顆星','感恩第二顆星','感恩第三顆星'];
const hints=['今天想感謝哪一個人？','今天發生了什麼值得感謝的事？','今天有什麼讓你感到幸福的事物？'];
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function errorText(e:unknown){return e instanceof Error?e.message:'發生未知錯誤'}
function draftKey(day:string){return 'gratitude-starry-device-draft-v1-'+day}
function readDraft(day:string):Draft[]{
  try{const raw=JSON.parse(localStorage.getItem(draftKey(day))||'[]') as string[];return Array.from({length:3},(_,i)=>({...empty(),text:typeof raw[i]==='string'?raw[i].slice(0,1500):''}));}
  catch{return Array.from({length:3},empty)}
}
export default function App(){
  const[day,setDay]=useState(localDate());
  const[session,setSession]=useState<Session|null>(null);
  const[items,setItems]=useState<Draft[]>(()=>readDraft(localDate()));
  const[status,setStatus]=useState('正在確認繁星會員…');
  const[history,setHistory]=useState<{day:string,filled:number}[]>([]);
  const[busy,setBusy]=useState<number|null>(null);
  const[percent,setPercent]=useState(0);
  const[showLogin,setShowLogin]=useState(false);
  const[activeTab,setActiveTab]=useState<'today'|'history'>('today');
  const timers=useRef<(ReturnType<typeof setTimeout>|null)[]>([null,null,null]);
  const speech=useRef<{stop:()=>void}|null>(null);
  const mediaURLs=useRef<string[]>([]);
  const tier:Tier=session?.tier||'free';
  const authed=Boolean(session?.authenticated);

  const refresh=useCallback(async()=>{
    try{setSession(await api.session());setStatus('')}
    catch{setSession({authenticated:false,tier:'free'});setStatus('目前無法連線，僅能使用本機草稿')}
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{
    if(location.pathname!=='/auth/callback')return;
    const code=new URLSearchParams(location.search).get('code')||'';
    window.history.replaceState(null,'','/');
    const issued=Number(sessionStorage.getItem('gratitude_login_intent_v1')||0);
    sessionStorage.removeItem('gratitude_login_intent_v1');
    if(!code||!issued||Date.now()-issued>600000||issued>Date.now()+10000){
      setStatus('登入驗證已過期，請重新登入');return;
    }
    let cancelled=false;
    void api.exchangeTicket(code).then(()=>refresh()).then(()=>{if(!cancelled){setShowLogin(false);setStatus('已登入繁星會員')}})
      .catch(e=>{if(!cancelled)setStatus('登入未完成：'+errorText(e))});
    return()=>{cancelled=true};
  },[refresh]);
  useEffect(()=>{
    let cancelled=false;
    if(!authed){setItems(readDraft(day));return}
    setStatus('讀取當日感恩日記…');
    void api.day(day).then(data=>{
      if(cancelled)return;
      const next=Array.from({length:3},(_,i)=>{
        const slot=i+1,found=data.entries.find(e=>e.slot===slot),media=data.media.find(m=>m.slot===slot);
        return {...empty(),text:found?.body||'',media:media||null};
      });setItems(next);setStatus('');
    }).catch(e=>{if(!cancelled)setStatus('讀取失敗：'+errorText(e))});
    return()=>{cancelled=true};
  },[day,authed]);
  useEffect(()=>{
    if(!authed){try{localStorage.setItem(draftKey(day),JSON.stringify(items.map(x=>x.text)))}catch{setStatus('本機空間不足，請複製日記內容保存')}}
  },[items,authed,day]);
  useEffect(()=>()=>{speech.current?.stop();timers.current.forEach(t=>t&&clearTimeout(t));mediaURLs.current.forEach(URL.revokeObjectURL)},[]);

  function change(index:number,text:string){
    setItems(old=>old.map((x,i)=>i===index?{...x,text:text.slice(0,1500)}:x));
    if(authed){if(timers.current[index])clearTimeout(timers.current[index]!);
      timers.current[index]=setTimeout(()=>{void api.save(day,index+1,text.slice(0,1500)).then(()=>setStatus('已自動儲存')).catch(e=>setStatus('儲存失敗：'+errorText(e)))},750);
    }
  }
  function saveNow(index:number){
    if(!authed)return;
    if(timers.current[index])clearTimeout(timers.current[index]!);
    void api.save(day,index+1,items[index].text).then(()=>setStatus('已自動儲存')).catch(e=>setStatus('儲存失敗：'+errorText(e)));
  }
  function voice(index:number){
    const BrowserSpeech=(window as Window & {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any}).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!BrowserSpeech){setStatus('此瀏覽器沒有提供語音輸入。可使用手機鍵盤的麥克風功能。');return}
    speech.current?.stop();
    const rec=new BrowserSpeech();rec.lang='zh-TW';rec.interimResults=false;rec.continuous=false;
    rec.onresult=(e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>{
      const t=e.results[0]?.[0]?.transcript||'';change(index,[items[index].text,t].filter(Boolean).join('，'));
    };
    rec.onerror=()=>setStatus('語音輸入失敗，請再試一次');rec.onend=()=>{speech.current=null};
    speech.current=rec;setStatus(`正在聆聽第 ${index+1} 件感恩…`);rec.start();
  }
  async function selectMedia(index:number,file?:File){
    if(!file)return;
    if(!authed){setStatus('目前僅儲存文字草稿。請先登入，才能安全上傳照片或影片。');setShowLogin(true);return}
    setBusy(index);setPercent(0);setStatus('正在壓縮影像，請保持畫面開啟…');
    try{
      const media=file.type.startsWith('image/')?await compressImage(file,tier):await compressVideo(file,tier,setPercent);
      const saved=await api.upload(day,index+1,media);
      const url=URL.createObjectURL(media.file);mediaURLs.current.push(url);
      setItems(old=>old.map((item,i)=>i===index?{...item,media:saved,localURL:url,localKind:saved.kind}:item));
      setStatus('影像已壓縮並安全儲存');
    }catch(e){setStatus('影像未上傳：'+errorText(e))}
    finally{setBusy(null);setPercent(0)}
  }
  async function removeMedia(index:number){
    const id=items[index].media?.id;if(!id)return;
    if(!confirm('確定移除此件感恩的照片或影片嗎？'))return;
    try{await api.deleteMedia(id);setItems(old=>old.map((x,i)=>i===index?{...x,media:null,localURL:null,localKind:null}:x));setStatus('附件已移除')}
    catch(e){setStatus('移除失敗：'+errorText(e))}
  }
  async function exportCard(){
    try{
      setStatus('正在產生宇宙感恩卡片…');
      const blob=await makeCard(day,items.map(x=>({text:x.text,kind:x.media?.kind||null,src:x.media?(x.localURL||`/api/media/${x.media.id}`):undefined})));
      const file=new File([blob],`繁星感恩日記-${day}.png`,{type:'image/png'});
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'我的三件感恩'});setStatus('已開啟分享')}
      else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setStatus('已匯出 PNG 感恩卡片')}
    }catch(e){setStatus('卡片製作未完成：'+errorText(e))}
  }
  function beginLogin(){
    sessionStorage.setItem('gratitude_login_intent_v1',String(Date.now()));
    window.location.assign('https://id.starry.phd/auth/gratitude');
  }
  async function logout(){
    await api.logout().catch(()=>undefined);setSession({authenticated:false,tier:'free'});setItems(readDraft(day));setShowLogin(false);setStatus('已登出，本機文字草稿與會員資料分開保存')
  }
  async function chooseHistory(){
    setActiveTab('history');if(!authed)return;
    try{const result=await api.history();setHistory(result.history)}catch(e){setStatus(errorText(e))}
  }
  function nextDay(diff:number){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+diff);setDay(localDate(d));setActiveTab('today')}
  const completed=items.filter(x=>x.text.trim().length>0).length;
  return <div className="app">
    <header className="topbar"><div className="logo">✦</div><div className="branding"><b>繁星感恩日記</b><small>GRATITUDE STARRY</small></div><button className="account" onClick={()=>authed?void logout():setShowLogin(true)}>{authed?'登出':'會員登入'}</button></header>
    <main>
      <section className="hero"><span className="kicker">✧ 你的每日感恩宇宙 ✧</span><div className="orbit orbit-a"/><div className="orbit orbit-b"/><h1>每天三件感恩<br/><span>點亮自己的宇宙</span></h1><p>珍藏那些讓生命閃閃發光的人、事、物。</p>
        <div className="progress"><span>{[1,2,3].map((n,i)=><span className={'star '+(i<completed?'lit':'')} key={n}>✦</span>)}</span><strong>{completed} / 3 顆感恩星</strong></div>
      </section>
      <div className="tabs"><button className={activeTab==='today'?'active':''} onClick={()=>setActiveTab('today')}>今日感恩</button><button className={activeTab==='history'?'active':''} onClick={()=>void chooseHistory()}>歷史日記</button></div>
      <div className="session-note"><span>{authed?'🔒 私密雲端日記 · 只有你能查看':'🔐 本機文字草稿 · 登入後才能同步與上傳影像'}</span><span>{tier==='pro'?'1080p 尊榮會員':'免費會員 480p'}</span></div>
      {activeTab==='today'?<>
        <div className="day-nav"><button aria-label="前一天" onClick={()=>nextDay(-1)}>‹</button><label>✨ {day} ✨</label><button aria-label="後一天" disabled={day>=localDate()} onClick={()=>nextDay(1)}>›</button></div>
        <div className="entries">
        {items.map((item,i)=><article className="entry" key={i}>
          <div className="entry-heading"><span className="entry-num">0{i+1}</span><div><h2>{labels[i]}</h2><p>{['一個值得感謝的人','一件讓你微笑的事','一樣值得珍惜的物'][i]}</p></div><span className="entry-star">✦</span></div>
          <textarea maxLength={1500} value={item.text} onChange={e=>change(i,e.target.value)} onBlur={()=>saveNow(i)} placeholder={hints[i]} rows={3} aria-label={labels[i]+'感恩內容'}/>
          <div className="entry-actions"><button onClick={()=>voice(i)} title="使用語音輸入">🎙️ 語音輸入</button><label className="filepick">📷 附加照片<input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={e=>{void selectMedia(i,e.target.files?.[0]);e.target.value=''}} disabled={busy!==null}/></label><label className="filepick">🎞️ 附加影片<input type="file" accept="video/mp4,video/webm,video/*" onChange={e=>{void selectMedia(i,e.target.files?.[0]);e.target.value=''}} disabled={busy!==null}/></label></div>
          {busy===i&&<div className="compress-progress" role="status">影像處理中 {percent}%<progress value={percent} max={100}/></div>}
          {item.media&&<div className="media-preview"><div>{item.media.kind==='image'?<img src={item.localURL||`/api/media/${item.media.id}`} alt="個人感恩照片"/>:<video controls playsInline preload="metadata" src={item.localURL||`/api/media/${item.media.id}`}/>}</div><button className="remove" onClick={()=>void removeMedia(i)}>移除此附件</button></div>}
          <small className="count">{item.text.length} / 1500 字</small>
        </article>)}
        </div>
        <button className="generate" onClick={()=>void exportCard()} disabled={completed===0}>✦ 產生銀河感恩卡片 ✦</button>
        <p className="hint">感恩卡片可存成圖片分享。你的私人日記和附件不會自動公開；分享圖片不包含原影片。</p>
      </>:<section className="history"><h2>🌌 我的感恩銀河</h2>{!authed?<p>登入後即可跨裝置查看歷史日記；本機草稿只能在此裝置使用。</p>:history.length?history.map(h=><button key={h.day} onClick={()=>{setDay(h.day);setActiveTab('today')}}><span>✦ {h.day}</span><span>{h.filled} 件感恩 →</span></button>):<p>尚無歷史記錄。寫下今天的第一件感恩吧！</p>}</section>}
      <div className="status" role="status" aria-live="polite">{status}</div>
      <footer>✦ STARRY.PHD ✦<div>你的感謝，值得被宇宙溫柔收藏</div></footer>
    </main>
    {showLogin&&<div className="modal-backdrop" role="presentation" onClick={()=>setShowLogin(false)}><div className="modal" role="dialog" aria-modal="true" aria-label="會員登入" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowLogin(false)} aria-label="關閉">✕</button><div className="modal-star">✦</div><h2>繁星通行證</h2><p>使用既有 Starry ID 帳號登入，保存私人感恩日記及照片影片。</p><button className="generate" onClick={beginLogin}>使用 Starry ID 登入</button><p className="login-help">還沒有帳號？<a href="https://id.starry.phd" target="_blank" rel="noopener noreferrer">前往繁星會員中心</a></p><small>登入由繁星通行證網站安全處理，不會將 Google 密碼交給日記 App。</small></div></div>}
  </div>
}
