import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function solar(){
 let sheet='',parallax='',updates=[];
 const body={style:{setProperty:(key,value)=>updates.push([key,value])}};
 const hero={querySelector:(selector)=>selector==='.solar-hero__body'?body:null};
 const document={
  getElementById:(id)=>id==='starrySolarHero'?hero:null,
  createElement:()=>({dataset:{},set textContent(value){sheet=value}}),
  head:{appendChild:()=>{}}
 };
 const window={};
 runInNewContext(read('solar-hero-v51.js'),{window,document});
 return {window,get css(){return sheet},updates};
}

test('giant hero replaces the small tenth planet without an API or new canvas',()=>{
 const html=read('index.html');
 assert.match(html,/id="starrySolarHero"/);
 assert.match(html,/class="solar-hero__disc"/);
 assert.match(html,/class="solar-hero__corona"/);
 assert.equal((html.match(/class="solar-hero__arc/g)||[]).length,0);
 assert.doesNotMatch(html,/planet-wrap p10/);
 assert.equal((html.match(/class="planet-wrap p[1-9]"/g)||[]).length,9);
 const app=read('app-v5.js');
 assert.match(app,/window\.starrySolarUpdate\?\.\(yaw,width,height\)/);
 const map=app.match(/const planetMap = \[([\s\S]*?)\];/)[1];
 const yaw=[...map.matchAll(/yaw:\s*(\d+)/g)].map(x=>+x[1]);
 assert.deepEqual(yaw,[0,40,80,120,160,200,240,280,320]);
 assert.doesNotMatch(read('solar-hero-v51.js'),/fetch\(|setInterval\(|requestAnimationFrame\(|getContext\(/);
});

test('180vw half-hidden sun stays beneath the site header without covering links',()=>{
 const x=solar(),css=x.css;
 assert.match(css,/\.solar-hero__body\{[\s\S]*?top:0/);
 assert.match(css,/transform:translate3d\(calc\(-50% \+ var\(--starry-solar-x,0px\)\),-75%,0\)/);
 assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.solar-hero__body\{width:180vw\}/);
 assert.match(css,/\.solar-hero\{[^}]*z-index:0/);
 assert.match(css,/\.planet-lane\{z-index:1\}/);
 assert.match(css,/\.brand-mark\{isolation:isolate\}/);
 assert.match(css,/\.brand-mark h1\{/);
 assert.match(css,/pointer-events:none/);
 assert.doesNotMatch(css,/clip-path:polygon\(/);
 assert.match(css,/radial-gradient\(/);
});

test('sun travels with finger at forty percent initial horizontal speed; 360 seam continuous',()=>{
 const s=solar(),fn=s.window.starrySolarParallaxX;
 assert.equal(typeof fn,'function');
 for(const [width,portrait,fov] of [[390,true,138],[1280,false,112]]){
   const eps=.05,base=80;
   const slope=(fn(base+eps,width,portrait)-fn(base-eps,width,portrait))/(2*eps);
   assert.ok(Math.abs(slope+width/fov*.4)<.001,'40% differential');
   assert.ok(Math.abs(fn(0,width,portrait)-fn(360,width,portrait))<1e-7);
   assert.ok(Math.abs(fn(80,width,portrait)-fn(440,width,portrait))<1e-7);
   assert.ok(Math.abs(fn(259.999,width,portrait)-fn(260.001,width,portrait))<.02);
   const amplitude=width*.4*180/(Math.PI*fov);
   assert.ok(Math.abs(fn(170,width,portrait)+amplitude)<.001);
 }
 s.window.starrySolarUpdate(80,390,844);
 s.window.starrySolarUpdate(90,390,844);
 assert.equal(s.updates.length,2);
 assert.equal(s.updates[0][0],'--starry-solar-x');
});

test('high flames animate only opacity; interaction pauses and low devices reduce effects',()=>{
 const css=solar().css;
 assert.doesNotMatch(css,/solar-hero__arc|starrySolarPlasma|@keyframes/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/radial-gradient\(ellipse 1\.55% 1\.15% at 25% 82%/);
 assert.match(css,/-webkit-text-stroke:\.55px rgba\(255,199,134,\.63\)/);
 assert.doesNotMatch(css,/backdrop-filter|filter:blur\(/);
 assert.match(read('sw.js'),/starry-shell-v31/);
 assert.match(read('.github/workflows/deploy.yml'),/solar-hero-v51\.js/);
 assert.match(read('.github/workflows/pr-check.yml'),/solar-hero-v51\.js/);
});
