import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('finger motion, inertia, tilt and camera never move vertically',()=>{
 const app=source('app-v5.js');
 assert.match(app,/function viewPitch\(\) \{ return 0; \}/);
 assert.match(app,/displayedPitch = 0;/);
 const drag=app.split('function moveDrag(e) {')[1].split('function runInertia()')[0];
 const inertia=app.split('function runInertia() {')[1].split('function endDrag')[0];
 assert.match(drag,/cameraYaw=normAngle\(cameraYaw-dx\*sens\)/);
 assert.doesNotMatch(drag,/cameraPitch|pitchVelocity|displayedPitch/);
 assert.doesNotMatch(inertia,/cameraPitch|pitchVelocity|displayedPitch/);
 assert.doesNotMatch(app,/targetTiltPitch\s*=/);
 assert.doesNotMatch(app,/autoPitch\s*=/);
});

test('planet groups stay in centered fixed vertical lanes on phone and desktop',()=>{
 const sandbox={window:{}};
 runInNewContext(source('navigation-safe-v44.js'),sandbox);
 const y=sandbox.window.starryCenteredPlanetY;
 assert.equal(typeof y,'function');
 for(const [width,height,header,groupHeight] of [
  [390,844,185,185],[375,667,175,165],[360,640,185,170],
  [320,568,160,155],[430,932,205,190],[844,390,70,150],
  [1280,720,90,190]
 ]){
  const viewport={width,height,headerBottom:header,groupHeight};
  const positions=[-23,0,23].map(p=>y(p,viewport));
  assert.ok(positions[0]>positions[1]&&positions[1]>positions[2],
    'three fixed lanes '+width+'x'+height);
  for(const position of positions){
   assert.ok(position>=0&&position<=height,
     'planet vertically in view '+width+'x'+height);
  }
  const raised=positions[1]*2-positions[0]-positions[2];
  assert.ok(raised>=0&&raised<=15.01,
    'upper lane raises by at most 15px at '+width+'x'+height);
 }
});

test('full-color groups are viewport-clipped, never angle faded or white',()=>{
 const app=source('app-v5.js');
 const solid=source('solid-planets-v32.js');
 const html=source('index.html');
 const card=source('universe-readability-v41.js');
 assert.match(app,/el\.style\.opacity = '1';/);
 assert.doesNotMatch(app,/el\.style\.opacity = `\$\{opacity\}`/);
 assert.match(html,/\.universe\{overflow:hidden!important/);
 assert.match(solid,/filter:none!important/);
 assert.match(solid,/backface-visibility:visible!important/);
 assert.match(card,/html\[data-starry-quality\] \.planet-wrap em\.service-label/);
 assert.match(card,/backdrop-filter:none!important/);
});

test('360 degree planet order, rewards and offline updates stay intact',()=>{
 const app=source('app-v5.js');
 const map=app.match(/const planetMap = \[([\s\S]*?)\];/)[1];
 const yaw=[...map.matchAll(/yaw:\s*(\d+)/g)].map(x=>+x[1]).slice(0,9);
 assert.deepEqual(yaw,[0,40,80,120,160,200,240,280,320]);
 assert.match(source('battery-game-v18.js'),/targetId:targetId\(rock\), sizeLevel/);
 assert.match(source('meteor-reward-bands-v41.js'),/hundredths/);
 assert.match(source('sw.js'),/starry-shell-v35/);
});
