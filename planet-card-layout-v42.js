// Small, allocation-light 2D collision solver. Keeps each planet, its name
// and its linked service card together; hides distant groups if no space remains.
(() => {
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const overlap=(a,b,pad=10)=>
    Math.abs(a.x-b.x)*2 < a.width+b.width+pad*2 &&
    Math.abs(a.y-b.y)*2 < a.height+b.height+pad*2;

  window.starryArrangePlanetCards=(items,view)=>{
    const width=Number(view.width)||0,height=Number(view.height)||0;
    const side=width<=760?11:18;
    const top=width<=760?Math.min(188,Math.max(112,height*.21)):Math.min(150,height*.16);
    const bottom=width<=760?Math.min(150,Math.max(104,height*.17)):85;
    const occupied=[];
    const output=items.map(item=>({...item,visible:false}));
    const eligible=items.filter(item=>item.visible && item.width && item.height)
      .sort((a,b)=>b.depth-a.depth);
    for(const item of eligible){
      const halfW=item.width/2,halfH=item.height/2;
      const minX=side+halfW,maxX=width-side-halfW;
      const minY=top+halfH,maxY=height-bottom-halfH;
      if(minX>maxX || minY>maxY)continue;
      // Do not teleport a planet from outside the viewport into the scene.
      if(item.x < -24 || item.x > width+24 ||
         item.y < top-halfH || item.y > height-bottom+halfH)continue;
      const seedX=clamp(item.x,minX,maxX),seedY=clamp(item.y,minY,maxY);
      const verticalStep=Math.max(64,item.height+12);
      const offsetsY=[0,-1,1,-2,2,-3,3];
      const offsetsX=[0,-.12,.12,-.24,.24];
      const candidates=[];
      for(const fy of offsetsY)for(const fx of offsetsX){
        const x=clamp(seedX+fx*width,minX,maxX);
        const y=clamp(seedY+fy*verticalStep,minY,maxY);
        if(Math.abs(x-item.x)>width*.38 || Math.abs(y-item.y)>Math.max(260,height*.34))continue;
        candidates.push({
          x,y,width:item.width,height:item.height,
          score:Math.abs(x-item.x)+Math.abs(y-item.y)*.86
        });
      }
      candidates.sort((a,b)=>a.score-b.score);
      const available=candidates.find(candidate=>
        !occupied.some(other=>overlap(candidate,other,10)));
      if(!available)continue;
      occupied.push(available);
      output[item.id]={...item,x:available.x,y:available.y,visible:true};
    }
    return output;
  };
})();
