import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function solar(){
 let css='',updates=[];
 const hero={querySelector:()=>({style:{setProperty:(k,v)=>updates.push([k,v])}})};
 const document={getElementById:()=>hero,
   createElement:()=>({dataset:{},set textContent(value){css=value}}),
   head:{appendChild(){}}};
 const window={};
 runInNewContext(read('solar-hero-v51.js'),{window,document});
 return {css,window,updates};
}
test('no flame SVG, polygons or plasma effects are left in the UI',()=>{
 const html=read('index.html'),css=solar().css;
 assert.match(html,/id="starrySolarHero"/);
 assert.match(html,/class="solar-hero__disc"/);
 assert.match(html,/class="solar-hero__corona"/);
 assert.doesNotMatch(html,/solar-hero__prominences|solar-hero__arc|solar-hero__flare/);
 assert.doesNotMatch(css,/solar-hero__prominences|solar-hero__arc|solar-hero__flare|starrySolarPlasma|@keyframes|clip-path:polygon/);
 assert.doesNotMatch(read('solar-hero-v51.js'),/setInterval\(|requestAnimationFrame\(|fetch\(|getContext\(/);
});
test('sun is still 180vw across but projects half the previous visible height',()=>{
 const css=solar().css;
 assert.match(css,/\.solar-hero__body\{[\s\S]*?top:0/);
 assert.match(css,/transform:translate3d\(calc\(-50% \+ var\(--starry-solar-x,0px\)\),-67\.5%,0\)/);
 assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.solar-hero__body\{width:180vw\}/);
 for(const width of [320,375,390,430,760]){
   const diameter=1.8*width;
   const previousVisible=diameter*.25,updatedVisible=diameter*.325;
   assert.ok(Math.abs(updatedVisible-previousVisible*1.3)<1e-8);
   assert.ok(updatedVisible>0);
 }
 assert.match(css,/\.solar-hero\{[\s\S]*?overflow:hidden;z-index:0;pointer-events:none/);
});
test('realistic texture has irregular darker spots, subdued sunrim and detailed warmth',()=>{
 const css=solar().css;
 assert.match(css,/radial-gradient\(ellipse 1\.55% 1\.15% at 25% 82%/);
 assert.match(css,/radial-gradient\(ellipse 1\.2% \.95% at 68% 88%/);
 assert.match(css,/radial-gradient\(ellipse 9% 3\.3% at 45% 91%/);
 assert.match(css,/\.solar-hero__disc::before\{/);
 assert.match(css,/\.solar-hero__disc::after\{/);
 assert.match(css,/\.solar-hero__corona\{/);
 assert.match(css,/rgba\(255,241,166,\.88\)/);
 assert.doesNotMatch(css,/repeating-conic-gradient|repeating-radial-gradient|backdrop-filter/);
});
test('platinum and champagne logo integrates with sunlight and stays readable',()=>{
 const css=solar().css,html=read('index.html');
 assert.match(html,/<h1>STARRY<span>\.PHD<\/span><\/h1>/);
 assert.match(css,/\.brand-mark::before\{content:none!important/);
 assert.match(css,/linear-gradient\(180deg,#fff4b9 0%,#ffbc38 14%,#ff7b12 30%/);
 assert.match(css,/-webkit-text-stroke:\.95px rgba\(255,148,32,\.92\)!important/);
 assert.match(css,/drop-shadow\(0 0 11px rgba\(255,140,15,\.87\)\)/);
 assert.match(css,/\.brand-mark \.brand-kicker\{/);
});
test('nine planets, Earth/Moon position, all apps, battery and PWA remain intact',()=>{
 const app=read('app-v5.js'),html=read('index.html');
 const yaw=[...app.match(/const planetMap = \[([\s\S]*?)\];/)[1].matchAll(/yaw:\s*(\d+)/g)].map(x=>+x[1]);
 assert.deepEqual(yaw,[0,40,80,120,160,200,240,280,320]);
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(app,/function viewPitch\(\) \{ return 0; \}/);
 assert.match(html,/\.earth-moon-companion\{left:calc\(50% \+ 34px\);top:17px\}/);
 assert.match(html,/\.moon\{width:19px!important;height:19px!important\}/);
 assert.match(read('battery-game-v18.js'),/targetId:id, sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
 assert.match(read('sw.js'),/starry-shell-v38/);
 assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v38/);
});
test('existing 40% seamless solar parallax is preserved without extra animation',()=>{
 const x=solar(),p=x.window.starrySolarParallaxX;
 for(const [width,portrait,fov] of [[390,true,138],[1280,false,112]]){
  const eps=.05,dyaw=80;
  const slope=(p(dyaw+eps,width,portrait)-p(dyaw-eps,width,portrait))/(eps*2);
  assert.ok(Math.abs(slope+width/fov*.4)<.001);
  assert.ok(Math.abs(p(0,width,portrait)-p(360,width,portrait))<1e-6);
 }
 x.window.starrySolarUpdate(80,390,844);
 x.window.starrySolarUpdate(90,390,844);
 assert.equal(x.updates.length,2);
});
