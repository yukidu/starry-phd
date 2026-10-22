export type CardItem={text:string,kind:'image'|'video'|null,src?:string};
function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function lines(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines:number){
  const out:string[]=[];let line='';for(const c of Array.from(text||'今日的小小幸福')){
    if(ctx.measureText(line+c).width>maxWidth&&line){out.push(line);line=c;}else line+=c;
  }if(line)out.push(line);return out.slice(0,maxLines).map((s,i)=>i===maxLines-1&&out.length>maxLines?s.slice(0,-1)+'…':s);
}
async function loadFrame(item:CardItem):Promise<CanvasImageSource|null>{
  if(!item.src||!item.kind)return null;
  if(item.kind==='image'){
    const image=new Image();image.src=item.src;
    try{await image.decode();return image}catch{return null}
  }
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;video.src=item.src;
  try{
    await new Promise<void>((resolve,reject)=>{
      video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(Error('no video'));
    });
    video.currentTime=Math.min(.2,video.duration/2);
    await new Promise<void>((resolve,reject)=>{video.onseeked=()=>resolve();video.onerror=()=>reject(Error('no frame'))});
    const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;
    c.getContext('2d')?.drawImage(video,0,0);return c;
  }catch{return null}
  finally{video.removeAttribute('src');video.load()}
}
function drawPhoto(ctx:CanvasRenderingContext2D,image:CanvasImageSource,w:number,h:number,x:number,y:number,boxW:number,boxH:number){
  const scale=Math.max(boxW/w,boxH/h),dw=w*scale,dh=h*scale;
  ctx.save();roundedRect(ctx,x,y,boxW,boxH,14);ctx.clip();ctx.drawImage(image,x+(boxW-dw)/2,y+(boxH-dh)/2,dw,dh);ctx.restore();
}
export async function makeCard(day:string,items:CardItem[]):Promise<Blob>{
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('無法產生圖片');
  const g=ctx.createLinearGradient(0,0,900,1350);g.addColorStop(0,'#061028');g.addColorStop(.47,'#26164d');g.addColorStop(1,'#080c2d');ctx.fillStyle=g;ctx.fillRect(0,0,900,1350);
  const neb=ctx.createRadialGradient(660,200,10,620,200,490);neb.addColorStop(0,'#8358bc75');neb.addColorStop(1,'#8358bc00');ctx.fillStyle=neb;ctx.fillRect(0,0,900,1350);
  for(let i=0;i<165;i++){
    const x=(i*619+83)%900,y=(i*433+111)%1350;
    ctx.beginPath();ctx.arc(x,y,i%13===0?2.5:1,0,Math.PI*2);ctx.fillStyle=i%7===0?'#ffeac7aa':'#c9ddff80';ctx.fill();
  }
  ctx.textAlign='center';ctx.fillStyle='#d5c2ff';ctx.font='bold 26px system-ui';ctx.fillText('✦  G R A T I T U D E   S T A R R Y  ✦',450,95);
  ctx.fillStyle='#bbd0fc';ctx.font='28px system-ui';ctx.fillText(day,450,150);
  ctx.fillStyle='#fff4d9';ctx.font='bold 54px system-ui';ctx.fillText('今天，點亮三顆感恩星',450,245);
  ctx.fillStyle='#e3ddff';ctx.font='27px system-ui';ctx.fillText('每一份感謝，都是宇宙的一道光',450,300);
  for(let i=0;i<3;i++){
    const y=350+i*286;roundedRect(ctx,58,y,784,253,28);ctx.fillStyle='#d5d1ff17';ctx.fill();ctx.strokeStyle='#b3a6eb55';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#a9acff';ctx.font='bold 48px system-ui';ctx.textAlign='left';ctx.fillText('0'+(i+1),86,y+72);
    const item=items[i],frame=item?await loadFrame(item):null;
    ctx.fillStyle='#f3f5ff';ctx.font='30px system-ui';
    const width=frame?405:635;
    lines(ctx,item?.text||'今天的美好，值得被記得。',width,4).forEach((line,j)=>ctx.fillText(line,175,y+70+j*45));
    if(frame){
      const w=frame instanceof HTMLImageElement?frame.naturalWidth:(frame as HTMLCanvasElement).width;
      const h=frame instanceof HTMLImageElement?frame.naturalHeight:(frame as HTMLCanvasElement).height;
      if(w>0&&h>0)drawPhoto(ctx,frame,w,h,626,y+37,180,155);
    }
    if(item?.kind){ctx.fillStyle='#b3d3fb';ctx.font='24px system-ui';ctx.fillText(item.kind==='video'?'▶ 珍藏影片・靜態影格':'▣ 感恩照片',175,y+216)}
  }
  ctx.textAlign='center';ctx.fillStyle='#ffeebf';ctx.font='bold 29px system-ui';ctx.fillText('✦  每日三件感恩，點亮自己的宇宙  ✦',450,1283);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('卡片輸出失敗')),'image/png'));
}
