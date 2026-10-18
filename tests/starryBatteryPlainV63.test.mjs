import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('signed-in numeric balance has no button chrome, background, border or rectangular shadow',()=>{
 const src=read('battery-game-v18.js');
 const rule=src.match(/#starryBatteryCenter \.battery-value:not\(\.login-ready\)\{([^}]+)\}/)?.[1];
 assert.ok(rule,'explicit signed-in numeric-only override');
 for(const token of [
   '-webkit-appearance:none!important',
   'appearance:none!important',
   'background:transparent!important',
   'background-image:none!important',
   'background-color:transparent!important',
   'border:0!important',
   'border-radius:0!important',
   'box-shadow:none!important',
   'text-shadow:none!important',
   'outline:none!important',
   'clip-path:none!important',
   'padding:0!important',
   'filter:none!important',
   '-webkit-backdrop-filter:none!important',
   'backdrop-filter:none!important'
 ]) assert.ok(rule.includes(token),'missing '+token);
 assert.match(src,/#starryBatteryCenter \.battery-value:not\(\.login-ready\)::before,[\s\S]*?#starryBatteryCenter \.battery-value:not\(\.login-ready\)::after\{content:none!important;display:none!important\}/);
});
test('dark filter enclosing stock number is removed at its original source',()=>{
 const solar=read('solar-hero-v51.js');
 const style=solar.match(/style\.textContent = ("(?:[^"\\]|\\.)*");/);
 assert.ok(style);
 const css=JSON.parse(style[1]);
 assert.match(css,/#starryBatteryCenter\{filter:none!important\}/);
 assert.doesNotMatch(css,/#starryBatteryCenter\{filter:drop-shadow\(/);
 assert.match(css,/\.brand-mark h1\{/);
 assert.match(css,/\.solar-hero__disc\{/);
});
test('existing cyan sign-in button still has complete background and glow',()=>{
 const src=read('battery-game-v18.js');
 const login=src.match(/#starryBatteryCenter \.battery-value\.login-ready\{([^}]+)\}/)?.[1];
 assert.ok(login);
 for(const property of ['background:linear-gradient(','border:1px solid','box-shadow:','color:#eaffff','animation:starryLoginPulse']){
   assert.ok(login.includes(property),'guest login change: '+property);
 }
 assert.match(src,/value\.classList\.add\('login-ready'\)/);
 assert.match(src,/value\.classList\.remove\('login-ready'\)/);
 assert.match(src,/void openLogin\(\)/);
});
test('golden battery type, large charge lightning and immediate correct totals remain',()=>{
 const src=read('battery-game-v18.js');
 assert.match(src,/#starryBatteryCenter \.battery-value\{[^\n]+color:#fff4a9/);
 assert.match(src,/batteryIcon\.textContent = '🔋'/);
 assert.match(src,/window\.StarryBatteryCharge\?\.mount\(batteryIcon\)/);
 assert.match(src,/window\.StarryBatteryCharge\?\.flash\(chargeBolt\)/);
 assert.match(read('starry-battery-charge-v1.js'),/width:124px;height:144px/);
 assert.match(src,/flashBattery\(\);/);
 assert.match(src,/optimisticAwards\.set\(id, cents\)/);
 assert.match(src,/renderBalance\(\);/);
 assert.match(src,/rewardQueue\.push\(\{ rock, x, y, id \}\)/);
 assert.match(src,/targetId:id, sizeLevel/);
 assert.match(src,/https:\/\/id\.starry\.phd\/api\/starry-game\/battery/);
 assert.match(read('meteor-v14.js'),/starry:meteor-blasted/);
});
test('PWA updates cache but keeps continuous galaxy, eco stop and foreground meteors',()=>{
 assert.match(read('sw.js'),/starry-shell-v39/);
 assert.match(read('visual-v15.js'),/html\[data-starry-quality="eco"\] \.milky-way\{filter:none!important;animation:none!important/);
 assert.match(read('index.html'),/\.universe > #meteorLayer\{position:absolute;inset:0;z-index:1;overflow:visible;pointer-events:none\}/);
 assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v39/);
});
