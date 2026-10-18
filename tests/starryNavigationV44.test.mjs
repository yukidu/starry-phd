import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function nav(){
 const scope={window:{}};
 runInNewContext(read('navigation-safe-v44.js'),scope);
 return scope.window.starrySafePlanetPosition;
}
test('planet/name/service group stays inside portrait viewport',()=>{
 const position=nav();
 for(const x of [-120,0,30,210,390,650]){
   const p={x,y:480,width:196,height:190};
   const result=position(p,{width:390,height:844});
   assert.equal(result.x,x,'true camera X is never independently clamped');
   assert.equal(result.y,480,'true camera Y is never independently clamped');
   assert.ok(result.fade>=0 && result.fade<=1);
 }
});
test('edge fading is smooth, fully visible at safe center',()=>{
 const position=nav();
 const centered=position({x:195,y:450,width:196,height:190},{width:390,height:844});
 const partial=position({x:48,y:450,width:196,height:190},{width:390,height:844});
 const outside=position({x:-200,y:450,width:196,height:190},{width:390,height:844});
 assert.equal(centered.fade,1);
 assert.ok(partial.fade>0&&partial.fade<1);
 assert.equal(outside.fade,0);
 assert.equal(partial.x,48);
 assert.equal(nav()({x:195,y:450,width:500,height:190},{width:390,height:844}).fade,0);
});
test('navigation soft starts and slows fast throws without extra work per frame',()=>{
 const app=read('app-v5.js');
 assert.match(app,/function updateSmoothCamera\(now\)/);
 assert.match(app,/displayedYaw = normAngle\(displayedYaw \+ normAngle\(viewYaw\(\) - displayedYaw\)/);
 assert.match(app,/yawVelocity\*=\.79/);
 assert.match(app,/cameraPitch=clamp\(cameraPitch\+dy\*sens,-36,36\)/);
 assert.match(app,/emptyViewFrames > 90/);
 assert.match(app,/if \(!planetSizes\) planetSizes = planets\.map/);
 assert.match(app,/starrySafePlanetPosition/);
});
test('keep the same planet style while the service labels are compact',()=>{
 const style=read('universe-readability-v41.js');
 assert.match(style,/width:max-content!important/);
 assert.match(style,/min-width:0!important/);
 assert.match(style,/font-size:20px!important/);
 assert.match(style,/\.planet-wrap\.p5 em\.service-label\{margin-top:26px!important\}/);
 assert.match(style,/\.planet-wrap\.p6 em\.service-label\{margin-top:26px!important\}/);
 assert.doesNotMatch(read('app-v5.js'),/starryArrangePlanetCards/);
});
test('battery updates reject stale GET and prior meteor POST values',()=>{
 const js=read('battery-game-v18.js');
 assert.match(js,/const generation = balanceGeneration/);
 assert.match(js,/generation !== balanceGeneration/);
 assert.match(js,/sequence !== balanceReadSequence \|\| activeRewardRequests/);
 assert.match(js,/Math\.max\(currentBalance, number\)/);
 assert.match(js,/activeRewardRequests = Math\.max\(0, activeRewardRequests - 1\)/);
 assert.match(js,/targetId:targetId\(rock\), sizeLevel/);
});
test('workflow builds mobile-safety script into production',()=>{
 assert.match(read('.github/workflows/deploy.yml'),/navigation-safe-v44\.js/);
 assert.match(read('.github/workflows/pr-check.yml'),/navigation-safe-v44\.js/);
});
