export type Tier = 'free'|'pro';
export type Transcoded = {file:Blob,mime:string,width:number,height:number,duration:number};
export function fitToTier(width:number,height:number,tier:Tier){
  const short = tier==='pro'?1080:480;
  const portrait=height>width;
  const maxW=portrait?short:Math.round(short*16/9), maxH=portrait?Math.round(short*16/9):short;
  const factor=Math.min(1,maxW/width,maxH/height);
  return {width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
}
export function timeLimit(tier:Tier){return tier==='pro'?30:15;}
async function loadedImage(file:File):Promise<HTMLImageElement>{
  const url=URL.createObjectURL(file);const image=new Image();image.decoding='async';image.src=url;
  try { await image.decode(); return image; } catch { URL.revokeObjectURL(url); throw Error('無法讀取照片'); }
}
export async function compressImage(file:File,tier:Tier):Promise<Transcoded>{
  if(!file.type.startsWith('image/')) throw Error('請選擇照片');
  const image=await loadedImage(file);
  try{
    const d=fitToTier(image.naturalWidth,image.naturalHeight,tier);
    const canvas=document.createElement('canvas');canvas.width=d.width;canvas.height=d.height;
    canvas.getContext('2d',{alpha:false})?.drawImage(image,0,0,d.width,d.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('照片壓縮失敗')),'image/jpeg',.78));
    return {file:blob,mime:'image/jpeg',...d,duration:0};
  }finally{ URL.revokeObjectURL(image.src); }
}
function waitEvent(target:HTMLMediaElement,eventName:string){
  return new Promise<void>((resolve,reject)=>{
    const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(Error('無法讀取影片'))};
    function cleanup(){target.removeEventListener(eventName,ok);target.removeEventListener('error',bad)}
    target.addEventListener(eventName,ok,{once:true});target.addEventListener('error',bad,{once:true});
  });
}
export async function compressVideo(file:File,tier:Tier,onProgress:(p:number)=>void):Promise<Transcoded>{
  if(!file.type.startsWith('video/'))throw Error('請選擇影片');
  if(typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function') throw Error('此瀏覽器不支援安全影片壓縮，請換用新版 Chrome 或 Safari');
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  video.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none';
  const objectURL=URL.createObjectURL(file);video.src=objectURL;document.body.append(video);
  let stream:MediaStream|undefined,audio:AudioContext|undefined,stopped=false;
  try{
    await waitEvent(video,'loadedmetadata');
    if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('影片長度無效');
    const duration=Math.min(video.duration,timeLimit(tier));
    const d=fitToTier(video.videoWidth,video.videoHeight,tier);
    const canvas=document.createElement('canvas');canvas.width=d.width;canvas.height=d.height;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('無法啟用影片壓縮');
    const fps=20;stream=canvas.captureStream(fps);
    // Capture the original audio along with the resized picture when supported.
    try{
      audio=new AudioContext();const src=audio.createMediaElementSource(video);
      const dest=audio.createMediaStreamDestination();src.connect(dest);
      for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
      await audio.resume();
    }catch{ /* Browser codec/audio policy may prohibit audio capture; reject rather than silently drop sound. */
      throw Error('此裝置無法保留影片聲音，未上傳原檔。請改用支援的瀏覽器');
    }
    const mime=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime)throw Error('此裝置不支援影片重新編碼');
    const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:tier==='pro'?3_500_000:950_000,audioBitsPerSecond:96000});
    const chunks:BlobPart[]=[];let raf=0;
    rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const done=new Promise<Blob>((resolve,reject)=>{
      rec.onerror=()=>reject(Error('影片壓縮中斷'));
      rec.onstop=()=>{stopped=true;cancelAnimationFrame(raf);const result=new Blob(chunks,{type:rec.mimeType.split(';')[0]});result.size?resolve(result):reject(Error('影片沒有成功輸出'))};
    });
    const paint=()=>{
      ctx.drawImage(video,0,0,d.width,d.height);
      onProgress(Math.min(99,Math.round(video.currentTime/duration*100)));
      if(!stopped&&video.currentTime<duration-0.04&&!video.ended)raf=requestAnimationFrame(paint);
      else if(rec.state!=='inactive')rec.stop();
    };
    await video.play();rec.start(800);paint();
    const blob=await done;
    onProgress(100);
    return {file:blob,mime:blob.type,...d,duration:Math.round(duration)};
  }finally{
    stopped=true;video.pause();stream?.getTracks().forEach(t=>t.stop());await audio?.close().catch(()=>undefined);video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(objectURL);
  }
}
