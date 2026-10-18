import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('twelve meteor size ranges map to an exact 1.00 to 0.01 award',()=>{
  const sandbox={window:{}};
  runInNewContext(source('meteor-reward-bands-v41.js'),sandbox);
  const rewards=Array.from({length:12},(_,i)=>sandbox.window.starryMeteorRewardTier(18+(i+.5)*1.5).hundredths);
  assert.deepEqual(rewards,[100,11,10,9,8,7,6,5,4,3,2,1]);
  assert.equal(sandbox.window.starryMeteorRewardTier(18).level,1);
  assert.equal(sandbox.window.starryMeteorRewardTier(36).level,12);
});
test('reward is derived from displayed size and sent as grade, not a client amount',()=>{
  assert.match(source('meteor-v14.js'),/originalSize >= 18 && originalSize <= 36/);
  assert.match(source('meteor-v14.js'),/dataset\.batterySizeLevel/);
  assert.match(source('battery-game-v18.js'),/targetId:targetId\(rock\), sizeLevel/);
  assert.match(source('meteor-feedback-v27.js'),/tierPreview\(rock\)/);
  assert.match(source('meteor-feedback-v27.js'),/starry:meteor-reward-failed/);
});
test('motion response is increased and supports iOS touch permission',()=>{
  const js=source('app-v5.js');
  assert.match(js,/targetTiltYaw = clamp\(filteredX \/ 22,-1,1\) \* 22/);
  assert.match(js,/targetTiltPitch = clamp\(filteredY \/ 22,-1,1\) \* 17/);
  assert.match(js,/motionPermissionAttempted/);
  assert.match(js,/orientationchange/);
});
test('name and URL cards grow and Saturn/Jupiter labels are separated',()=>{
  const js=source('universe-readability-v41.js');
  assert.match(js,/universe-readability-v41/);
  assert.match(js,/\.planet-wrap\.p5 > \.celestial-name/);
  assert.match(js,/\.planet-wrap\.p6 > \.celestial-name/);
  assert.match(js,/font-size:18px!important/);
  assert.match(source('.github/workflows/deploy.yml'),/universe-readability-v41\.js/);
});
