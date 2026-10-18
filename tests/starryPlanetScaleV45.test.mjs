import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('planet sizes remain between Earth / 1.2 and Earth * 1.2',()=>{
  const js=read('app-v5.js');
  const block=js.match(/const planetMap = \[([\s\S]*?)\];/);
  assert.ok(block);
  const sizes=[...block[1].matchAll(/size:\s*([\d.]+)/g)].map(m=>Number(m[1]));
  assert.equal(sizes.length,9);
  assert.equal(sizes[2],1);
  for(const n of sizes) assert.ok(n>=1/1.2&&n<=1.2, 'size '+n);
  assert.ok(js.includes('const scale = p.size * (.95 + centerBoost * .05)'));
});
test('Earth base diameter shared by all planets on phone and desktop',()=>{
  const css=read('universe-readability-v41.js');
  assert.ok(css.includes(':root{--starry-earth-diameter:64px}'));
  assert.ok(css.includes(':root{--starry-earth-diameter:52px}'));
  assert.ok(css.includes('.planet-wrap > .planet{'));
  assert.ok(css.includes('width:var(--starry-earth-diameter)!important'));
  assert.ok(css.includes('height:var(--starry-earth-diameter)!important'));
  assert.ok(css.includes('width:calc(var(--starry-earth-diameter) * 1.10)!important'));
});
test('planet labels are fully transparent but keep the readable enlarged text',()=>{
  const css=read('universe-readability-v41.js');
  const block=css.split('.planet-wrap > .celestial-name{')[1]?.split('}')[0];
  assert.ok(block);
  assert.ok(block.includes('font-size:18px!important'));
  assert.ok(block.includes('background:transparent!important'));
  assert.ok(block.includes('border:0!important'));
  assert.ok(block.includes('box-shadow:none!important'));
  assert.ok(block.includes('text-shadow:'));
  assert.ok(css.includes('.earth-moon-companion .celestial-name{'));
});
test('phone tilt returns to 6 and 4 without changing swipe smoothness',()=>{
  const js=read('app-v5.js');
  assert.ok(js.includes('targetTiltYaw = clamp(x / 24,-1,1) * 6'));
  assert.ok(!js.includes('targetTiltPitch = clamp(y / 24,-1,1) * 4'));
  assert.ok(!js.includes('targetTiltYaw = clamp(filteredX / 22'));
  assert.ok(js.includes('function updateSmoothCamera(now)'));
  assert.ok(js.includes('const sens=.27;'));
});
