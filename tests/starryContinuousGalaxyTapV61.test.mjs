import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app-v5.js'),visual=read('visual-v15.js'),html=read('index.html');

function clickHarness(){
  let now=100,timerId=0,sounds=0,cancelled=0,created=0;
  const timers=new Map(),rings=[];
  const document={
    createElement(tag){created++;return {tag,children:[],className:'',style:{left:'',top:''},
      appendChild(ch){this.children.push(ch)},
      remove(){const i=rings.indexOf(this);if(i>=0)rings.splice(i,1)}
    }},
    body:{appendChild(el){rings.push(el)}}
  };
  const ctx={document,performance:{now:()=>now},width:390,Math,
    fxTone(){sounds++},
    setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},
    clearTimeout(id){if(timers.delete(id))cancelled++}
  };
  const body='let lastMeteorBlastAt=-Infinity;let currentClickRing=null,clickRingTimer=null,lastClickSoundAt=-Infinity;'+
    'function clickFx(x,y) {'+app.split('  function clickFx(x,y) {')[1].split('\n  function isInteractive')[0];
  runInNewContext(body+';this.clickFx=clickFx;this.markMeteor=()=>{lastMeteorBlastAt=performance.now()};',ctx);
  return {tap:(x,y,ms)=>{now=ms;ctx.clickFx(x,y)},markMeteor:()=>ctx.markMeteor(),rings,
    stats:()=>({created,sounds,cancelled,timers:timers.size})};
}
test('rapid 300 screen taps keep exactly ONE tiny click ring with ZERO sparks',()=>{
 const fx=clickHarness();
 for(let i=0;i<300;i++){
   fx.tap(70+i%100,150,100+i*5);
   assert.equal(fx.rings.length,1);
   assert.equal(fx.rings[0].children.length,0);
 }
 const result=fx.stats();
 assert.equal(result.created,300);
 assert.equal(result.cancelled,299);
 assert.equal(result.timers,1);
 assert.ok(result.sounds>=15&&result.sounds<=20,'throttled sound remains audible');
});
test('meteor blast suppresses the generic glow and tone on same pointer tap',()=>{
 const fx=clickHarness();
 fx.tap(60,70,100);
 fx.markMeteor();
 fx.tap(60,70,150);
 assert.equal(fx.stats().created,1);
 fx.tap(60,70,330);
 assert.equal(fx.stats().created,2);
});
test('tap effect needs no GPU-heavy shadows, filters or spark child nodes',()=>{
 const style=html.split('\n').find(line=>line.trim().startsWith('.click-burst{'));
 assert.match(style,/box-shadow:none!important;filter:none!important/);
 assert.match(style,/animation:burstRing \.32s/);
 assert.doesNotMatch(style,/42px|box-shadow:0 0|filter:blur|drop-shadow/);
 assert.match(html,/\.click-burst::before,\.click-burst::after\{content:none!important\}/);
 assert.match(html,/\.click-spark\{display:none!important\}/);
 assert.doesNotMatch(app.slice(app.indexOf('  function clickFx('),app.indexOf('  function isInteractive(')),/click-spark|for\(let i=0;i<12/);
 assert.match(app,/o\.onended=\(\)=>\{/);
});
test('Milky Way continuously rotates while dragging in high, medium and low',()=>{
 assert.match(html,/\.milky-way\{.*animation:galaxyFlow 46s linear infinite/);
 assert.doesNotMatch(visual,/html\[data-starry-interacting="1"\] \.milky-way/);
 assert.match(visual,/html\[data-starry-interacting="1"\] \.planet-wrap \.planet>span\{animation-play-state:paused!important\}/);
 assert.match(visual,/html\[data-starry-hidden="1"\] \.milky-way/);
});
test('eco mode halts galaxy; OS reduced-motion also halts regardless of quality',()=>{
 assert.match(visual,/html\[data-starry-quality="eco"\] \.milky-way\{filter:none!important;animation:none!important;opacity:\.48!important\}/);
 assert.match(visual,/html\[data-starry-quality="eco"\] \.milky-way \.galaxy-stars-a\{animation:none!important/);
 assert.match(visual,/@media\(prefers-reduced-motion:reduce\)\{\s*\.milky-way,\.milky-way::before,\.milky-way \.galaxy-stars-a\{animation:none!important\}/);
 assert.match(read('sw.js'),/starry-shell-v37/);
});
test('solar, planet order, meteor depth and battery rewards remain untouched',()=>{
 const m=app.match(/const planetMap = \[([\s\S]*?)\];/);
 assert.ok(m);
 const yaw=[...m[1].matchAll(/yaw:\s*(\d+)/g)].map(x=>Number(x[1]));
 assert.deepEqual(yaw,[0,40,80,120,160,200,240,280,320]);
 assert.match(html,/\.universe > #meteorLayer\{position:absolute;inset:0;z-index:1;overflow:visible;pointer-events:none\}/);
 assert.match(html,/\.universe > \.planet-lane\{z-index:2;pointer-events:none\}/);
 assert.match(read('battery-game-v18.js'),/targetId:id, sizeLevel/);
 assert.match(read('meteor-v14.js'),/playExplosionSound\(\);/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
 assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v37/);
});
