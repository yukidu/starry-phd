import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function harness({cores=4,memory=4,mobile=true}={}){
 let clock=0, frame;
 const documentListeners={};
 const root={dataset:{}};
 const stars={style:{},width:0,height:0,
   insertAdjacentElement(){},
   getContext(){return drawing}};
 const drawing={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 const document={
  hidden:false,documentElement:root,
  querySelector:s=>s==='#starfield'?stars:null,
  querySelectorAll:()=>[],
  createElement:tag=>({id:'',dataset:{},style:{},setAttribute(){},appendChild(){},getContext(){return drawing}}),
  head:{appendChild(){}},
  addEventListener:(type,cb)=>{documentListeners[type]=cb}
 };
 const window={};
 const ctx={
  document,window,innerWidth:390,innerHeight:844,devicePixelRatio:2,
  matchMedia:query=>({matches:mobile && query.includes('900px')}),
  navigator:{hardwareConcurrency:cores,deviceMemory:memory,maxTouchPoints:mobile?1:0},
  performance:{now:()=>clock},
  requestAnimationFrame:cb=>{frame=cb;},
  addEventListener(){},
  Math
 };
 runInNewContext(read('visual-v15.js'),ctx);
 const advance=(fps,seconds)=>{
  for(let k=0;k<fps*seconds;k++){
   clock+=1000/fps;
   const callback=frame;
   assert.equal(typeof callback,'function');
   callback(clock);
  }
 };
 return {window,document,root,advance,documentListeners};
}
test('low-end CPU/RAM starts low; capability is only a hint, not permanent tier',()=>{
 const slow=harness({cores:4,memory:4});
 assert.equal(slow.window.starryPerformance.getTier(),'low');
 assert.equal(slow.root.dataset.starryQuality,'low');
 assert.equal(slow.window.starryPerformance.primaryInterval(),48);
 assert.equal(slow.window.starryPerformance.primaryStarFraction(),.5);
 const modern=harness({cores:8,memory:8});
 assert.equal(modern.window.starryPerformance.getTier(),'medium');
 assert.equal(modern.window.starryPerformance.primaryInterval(),32);
});
test('sustained severe FPS below 25 enters eco without additional timers',()=>{
 const env=harness();
 env.advance(20,16);
 assert.equal(env.window.starryPerformance.getTier(),'eco');
 assert.equal(env.window.starryPerformance.primaryInterval(),82);
 assert.equal(env.window.starryPerformance.primaryStarFraction(),.32);
 assert.equal(env.root.dataset.starryQuality,'eco');
 const visual=read('visual-v15.js');
 assert.doesNotMatch(visual,/setInterval\(/);
 assert.match(visual,/if \(fps < 25 && lowWindows >= 2\) changeQuality\('eco'\)/);
});
test('60 FPS recovery progressively raises visual tier without changing reward logic',()=>{
 const env=harness();
 env.advance(20,16);
 assert.equal(env.window.starryPerformance.getTier(),'eco');
 env.advance(60,32);
 assert.ok(['low','medium','high'].includes(env.window.starryPerformance.getTier()));
});
test('old phones reduce decorative meteors but keep regular meteor rewards intact',()=>{
 const env=harness();
 env.advance(20,16);
 const perf=env.window.starryPerformance;
 assert.equal(typeof perf.allowMeteor('extra'),'boolean');
 assert.match(read('meteor-v14.js'),/window\.starryPerformance\.allowMeteor\('extra'\)/);
 assert.match(read('app-v5.js'),/window\.starryPerformance\.allowMeteor\(kind\)/);
 assert.match(read('battery-game-v18.js'),/targetId:id, sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
test('page hidden resets performance samples and blocks meteor spawning',()=>{
 const env=harness();
 env.document.hidden=true;
 env.documentListeners.visibilitychange();
 assert.equal(env.root.dataset.starryHidden,'1');
 assert.equal(env.window.starryPerformance.allowMeteor('small'),false);
 env.document.hidden=false;
 env.documentListeners.visibilitychange();
 assert.equal(env.root.dataset.starryHidden,'0');
});
test('touch drag remains full native frame rate even if background drawing is slower',()=>{
 const app=read('app-v5.js'),visual=read('visual-v15.js');
 assert.match(app,/renderPlanets\(\);\s*lastRenderedPlanetYaw = displayedYaw/);
 assert.match(app,/if \(dragging \|\| inertiaActive \|\| !Number\.isFinite\(lastRenderedPlanetYaw\)/);
 assert.match(app,/const redrawStars = !lastPrimaryDraw \|\| now - lastPrimaryDraw >= interval/);
 assert.match(app,/requestAnimationFrame\(drawStarfield\)/);
 assert.match(visual,/requestAnimationFrame\(draw\)/);
 assert.match(visual,/renderTick % 3 !== 0/);
 assert.match(app,/cameraYaw=normAngle\(cameraYaw-dx\*sens\)/);
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
});
test('eco level reduces galaxy and oversized solar blur, but keeps planets sharp',()=>{
 const visual=read('visual-v15.js'),solar=read('solar-hero-v51.js');
 assert.match(visual,/html\[data-starry-quality="eco"\] \.milky-way\{filter:none!important;animation:none!important/);
 assert.match(visual,/html\[data-starry-quality="eco"\] \.milky-way \.galaxy-stars-a\{animation:none!important/);
 assert.match(solar,/html\[data-starry-quality=\\"eco\\"\] \.solar-hero__disc\{filter:blur\(4px\)\}/);
 assert.match(read('solid-planets-v32.js'),/filter:none!important/);
 assert.match(read('sw.js'),/starry-shell-v42/);
});
