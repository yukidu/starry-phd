import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

test('planet groups fade continuously instead of being hidden at an arbitrary camera angle',()=>{
 const app=source('app-v5.js');
 assert.doesNotMatch(app,/if \(!visible\)/);
 assert.match(app,/const layoutPitch = p.pitch - clamp\(pitch,-20,20\)/);
 assert.match(app,/const opacity = clamp\(\(centerBoost-\.25\)\*1\.5,\.7,1\) \* safe\.fade/);
 const solid=source('solid-planets-v32.js');
 assert.doesNotMatch(solid,/\.planet-wrap\{opacity:1!important\}/);
 assert.doesNotMatch(solid,/visibility:hidden!important/);
});

test('nine 40-degree positions spread among three vertical lanes, including the seam',()=>{
 const app=source('app-v5.js');
 const block=app.match(/const planetMap = \[([\s\S]*?)\];/)[1];
 const pitch=[...block.matchAll(/pitch:\s*(-?\d+)/g)].map(m=>+m[1]).slice(0,9);
 assert.deepEqual(pitch,[-23,0,23,-23,0,23,-23,0,23]);
 const scope={window:{}};
 runInNewContext(source('navigation-safe-v44.js'),scope);
 const safe=scope.window.starrySafePlanetPosition;
 for(const viewPitch of [-20,0,20]){
  for(let heading=0;heading<360;heading+=10){
   let visible=0;
   for(let i=0;i<9;i++){
    const dyaw=((i*40-heading+540)%360)-180;
    const x=195+(dyaw/69)*195;
    const y=844*.56-((pitch[i]-viewPitch)/41)*844*.28;
    const group=safe({x,y,width:155,height:173},{width:390,height:844,headerBottom:180});
    if(group.fade>.12) visible++;
   }
   assert.ok(visible>=2,'no empty view at '+heading+' pitch '+viewPitch);
  }
 }
});

test('earth atmosphere and Saturn rings are optical only; cards clear their surfaces',()=>{
 const css=source('universe-readability-v41.js');
 assert.match(css,/\.planet-wrap \.saturn \.ring\{[\s\S]*?1\.87/);
 assert.match(css,/height:calc\(var\(--starry-earth-diameter\) \* \.612\)/);
 assert.match(css,/\.planet-wrap \.earth::after/);
 assert.match(css,/inset:-25%/);
 assert.match(css,/\.planet-wrap\.p6 em\.service-label\{margin-top:40px!important\}/);
 assert.match(css,/\.planet-wrap\.p3 em\.service-label\{margin-top:28px!important\}/);
 assert.match(css,/font-weight:400!important/);
});

test('responsive motion keeps device tilt unchanged and reduces work during swipes',()=>{
 const app=source('app-v5.js'), visual=source('visual-v15.js');
 assert.match(app,/const sens=\.27/);
 assert.match(app,/setInteractionMode\(true\)/);
 assert.match(app,/setInteractionMode\(false\)/);
 assert.match(app,/width <= 760 \? 1\.35 : 2/);
 assert.match(app,/targetTiltYaw = clamp\(x \/ 24,-1,1\) \* 6/);
 assert.match(app,/targetTiltPitch = clamp\(y \/ 24,-1,1\) \* 4/);
 assert.match(visual,/renderTick % 3 !== 0/);
 assert.match(visual,/animation-play-state:paused!important/);
});
