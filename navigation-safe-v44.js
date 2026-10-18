// navigation-safe-v47: continuous motion + protected header/battery zone.
// Individual edge clamping made near-edge planets freeze while their
// neighbors kept moving, causing unsynchronized swipes. Only fade.
(() => {
  const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
  window.starrySafePlanetPosition=(planet,viewport)=>{
    const vw=Number(viewport.width),vh=Number(viewport.height);
    const mobile=vw<=760;
    const side=mobile?12:18;
    const headerBottom=Number.isFinite(Number(viewport.headerBottom))
      ? Number(viewport.headerBottom) : 0;
    const baseTop=mobile?Math.min(210,Math.max(124,vh*.235)):48;
    const top=Math.max(baseTop,headerBottom+12);
    const bottom=mobile?Math.min(135,Math.max(96,vh*.155)):52;
    const halfW=Number(planet.width)/2;
    const halfH=Number(planet.height)/2;
    const minX=halfW+side,maxX=vw-halfW-side;
    const minY=halfH+top,maxY=vh-halfH-bottom;
    if (!(vw>0&&vh>0&&minX<=maxX&&minY<=maxY))
      return {x:planet.x,y:planet.y,fade:0};
    // Each planet stays at its true camera-projected location, so every
    // planet, title and linked card travels in perfect step with the others.
    // Fade near an edge without ever freezing or pulling an individual
    // planet toward the center. Preserve safe areas for heading and shops.
    const fadeDistance=mobile?85:90;
    // The top of the WHOLE group (title, sphere, card) must be entirely
    // below the site title and battery before becoming visible at all.
    // This is a fade-only boundary; never pin one planet's X/Y.
    const fade=Math.min(
      clamp((planet.x-minX+fadeDistance)/fadeDistance,0,1),
      clamp((maxX-planet.x+fadeDistance)/fadeDistance,0,1),
      clamp((planet.y-minY)/fadeDistance,0,1),
      clamp((maxY-planet.y)/fadeDistance,0,1)
    );
    return {x:planet.x,y:planet.y,fade};
  };

  // V49: stable three-lane vertical layout, centered within usable screen
  // space. Never reposition an individual planet based on its x/y position.
  window.starryCenteredPlanetY=(pitch,viewport)=>{
    const vw=Number(viewport.width),vh=Number(viewport.height);
    const mobile=vw<=760;
    const header=Number(viewport.headerBottom)||0;
    const groupHeight=Math.max(150,Number(viewport.groupHeight)||150);
    const safeTop=mobile?Math.max(165,Math.min(210,vh*.235),header+22)
      :Math.max(80,header+22);
    const safeBottom=mobile?Math.min(135,Math.max(98,vh*.155)):70;
    const margin=groupHeight/2+8;
    const low=safeTop+margin;
    const high=vh-safeBottom-margin;
    const center=high>=low?(low+high)/2:Math.max(0,vh*.5);
    const maxSpread=Math.max(0,(high-low)/2);
    const spread=Math.min(mobile?104:130,vh*(mobile?.125:.15),maxSpread);
    const baseY=center-clamp(Number(pitch)/23,-1,1)*spread;
    // V57: raise only the upper lane, but never enter the fixed title/battery.
    const upperRaise=Number(pitch)>0
      ? Math.min(15,Math.max(0,baseY-(header+groupHeight/2+10)))
      : 0;
    return baseY-upperRaise;
  };
})();
