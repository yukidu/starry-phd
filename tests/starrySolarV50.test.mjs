import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test("the first rendered viewpoint is Earth's yaw without animation lag",()=>{
 const app=read('app-v5.js');
 const map=app.match(/const planetMap = \[([\s\S]*?)\];/);
 assert.ok(map);
 const items=[...map[1].matchAll(/yaw:\s*(\d+), pitch:\s*(-?\d+), size:\s*([\d.]+)/g)]
   .map((m)=>({yaw:+m[1],pitch:+m[2],size:+m[3]}));
 assert.equal(items.length,9);
 assert.equal(items[2].yaw,80);
 assert.equal(items[2].pitch,0,'Earth occupies the centered vertical lane');
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(app,/let displayedYaw = 80, displayedPitch = 0, lastFrameAt = 0;/);
 assert.match(app,/if \(!event\.persisted\) return;[\s\S]*?cameraYaw = 80;[\s\S]*?displayedYaw = 80;/);
 const projection=390/2+((items[2].yaw-80)/69)*390/2;
 assert.equal(projection,195,'Earth center must project to center of 390px phone');
 const sandbox={window:{}};
 runInNewContext(read('navigation-safe-v44.js'),sandbox);
 const center=sandbox.window.starryCenteredPlanetY(0,
   {width:390,height:844,headerBottom:185,groupHeight:185});
 assert.ok(center>300&&center<600);
});

test('Sun is an independent hero while nine planets keep their original slots',()=>{
 const app=read('app-v5.js'),html=read('index.html');
 const raw=app.match(/const planetMap = \[([\s\S]*?)\];/)[1];
 const planetYaws=[...raw.matchAll(/yaw:\s*(\d+)/g)].map(m=>+m[1]);
 assert.deepEqual(planetYaws,[0,40,80,120,160,200,240,280,320]);
 assert.match(html,/id="starrySolarHero"/);
 assert.doesNotMatch(html,/planet-wrap p10/);
 assert.match(html,/class="solar-hero__disc"/);
 assert.match(app,/window\.starrySolarUpdate\?\.\(yaw,width,height\)/);
 const css=read('solar-hero-v51.js');
 assert.match(css,/starrySolarParallaxX/);
 assert.doesNotMatch(css,/fetch\(/);
});

test('Mercury is still shown with no Starry main card or link',()=>{
 const html=read('index.html');
 const mercury=html.split('<div class="planet-wrap p1">')[1]?.split('\n')[0];
 assert.ok(mercury);
 assert.match(mercury,/水星/);
 assert.match(mercury,/planet mercury/);
 assert.doesNotMatch(mercury,/service-label|service-host|starry\.phd/);
 assert.ok(!html.includes('繁星主站'));
 assert.match(read('interaction-v16.js'),/document\.querySelectorAll\('\.planet-wrap\[data-url\]'\)/);
});

test('all card clearances shrink but do not overlap Earth atmosphere or Saturn ring',()=>{
 const css=read('universe-readability-v41.js');
 for(const [group,gap] of [['','8'],['.p3','17'],['.p5','10'],['.p6','12']]){
   const selector=group?'.planet-wrap'+group+' em.service-label':'.planet-wrap em.service-label';
   assert.ok(css.includes(selector+'{margin-top:'+gap+'px!important}'),selector);
 }
 assert.match(css,/\.planet-wrap \.earth::after\{[\s\S]*?inset:-25%/);
 assert.match(css,/\.planet-wrap \.saturn \.ring\{[\s\S]*?1\.87/);
 const earthDiameter=52,flexGap=5,atmosphereExtension=earthDiameter*.25;
 assert.ok(flexGap+17-atmosphereExtension>=8);
 const saturnDiameter=52,ringWidth=52*1.87,ringHeight=52*.612;
 const rotatedHalfHeight=(ringWidth*Math.sin(16*Math.PI/180)+
   ringHeight*Math.cos(16*Math.PI/180))/2;
 assert.ok(flexGap+12-(rotatedHalfHeight-saturnDiameter/2)>=8);
});

test('keep horizontal-only controls, 12-tier rewards and new PWA cache',()=>{
 const app=read('app-v5.js');
 assert.match(app,/function viewPitch\(\) \{ return 0; \}/);
 assert.match(app,/cameraYaw=normAngle\(cameraYaw-dx\*sens\)/);
 assert.doesNotMatch(app,/cameraPitch=/);
 assert.match(read('battery-game-v18.js'),/sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
 assert.match(read('sw.js'),/starry-shell-v28/);
});
