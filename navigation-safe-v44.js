// navigation-safe-v44: screen-edge bounds with a soft fade, not the
// reverted #42 card rearrangement. Keeps each planet/name/service together.
(() => {
  const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
  window.starrySafePlanetPosition=(planet,viewport)=>{
    const vw=Number(viewport.width),vh=Number(viewport.height);
    const mobile=vw<=760;
    const side=mobile?12:18;
    const top=mobile?Math.min(210,Math.max(124,vh*.235)):48;
    const bottom=mobile?Math.min(135,Math.max(96,vh*.155)):52;
    const halfW=Number(planet.width)/2;
    const halfH=Number(planet.height)/2;
    const minX=halfW+side,maxX=vw-halfW-side;
    const minY=halfH+top,maxY=vh-halfH-bottom;
    if (!(vw>0&&vh>0&&minX<=maxX&&minY<=maxY))
      return {x:planet.x,y:planet.y,fade:0};
    const x=clamp(planet.x,minX,maxX),y=clamp(planet.y,minY,maxY);
    const spill=Math.max(Math.abs(planet.x-x),Math.abs(planet.y-y));
    // Fade away if a whole group is far outside the view; do not glue
    // planets to the border, and never cut names or card links in half.
    const fade=clamp(1-spill/(mobile?75:100),0,1);
    return {x,y,fade};
  };
})();
