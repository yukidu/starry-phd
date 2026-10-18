import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function sheet(){
 let css='';
 const body={style:{setProperty(){}}};
 const root={querySelector:()=>body};
 const doc={getElementById:()=>root,
 createElement:()=>({dataset:{},set textContent(v){css=v}}),
 head:{appendChild(){}}};
 runInNewContext(read('solar-hero-v51.js'),{window:{},document:doc});
 return css;
}
test('large solar hero no longer has unnatural polygon, arc or spike effects',()=>{
 const html=read('index.html'),css=sheet();
 assert.match(html,/id="starrySolarHero"/);
 assert.match(html,/solar-hero__disc/);
 assert.doesNotMatch(html,/solar-hero__prominences|solar-hero__arc|solar-hero__flare/);
 assert.doesNotMatch(css,/clip-path:polygon|starrySolarPlasma|@keyframes/);
 assert.match(css,/\.solar-hero__disc::before\{/);
 assert.match(css,/\.solar-hero__disc::after\{/);
});
test('solar hero remains below foreground planets, title and links',()=>{
 const css=sheet();
 assert.match(css,/\.solar-hero\{[\s\S]*?overflow:hidden;z-index:0;pointer-events:none/);
 assert.match(css,/\.solar-hero__disc\{[\s\S]*?z-index:1/);
 assert.match(css,/\.planet-lane\{z-index:1\}/);
 assert.match(css,/\.brand-mark::before\{/);
 assert.doesNotMatch(css,/backdrop-filter/);
});
test('Earth remains central until horizontal drag',()=>{
 const js=read('app-v5.js');
 assert.match(js,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(js,/let displayedYaw = 80, displayedPitch = 0, lastFrameAt = 0;/);
 assert.doesNotMatch(js,/autoYaw = normAngle\(autoYaw \+ 0\.013\)/);
 assert.match(js,/cameraYaw=normAngle\(cameraYaw-dx\*sens\)/);
 assert.match(js,/function viewPitch\(\) \{ return 0; \}/);
});
test('moon keeps the approved size and distance next to Earth',()=>{
 const html=read('index.html');
 assert.match(html,/\.earth-moon-companion\{left:calc\(50% \+ 34px\);top:17px\}/);
 assert.match(html,/\.moon\{width:19px!important;height:19px!important\}/);
 assert.match(html,/\.earth-moon-companion\{position:absolute;z-index:4;left:calc\(50% \+ 40px\)/);
 assert.match(html,/\.moon\{width:24px!important;height:24px!important/);
 assert.match(read('universe-readability-v41.js'),/\.planet-wrap \.earth::after/);
});
test('warm solar light, title clarity and retained rewards',()=>{
 const css=sheet();
 assert.match(css,/\.brand-mark h1\{/);
 assert.match(css,/-webkit-text-fill-color:transparent!important/);
 assert.match(css,/text-shadow:none!important/);
 assert.match(css,/\.planet-wrap > \.planet:not\(\.moon\):not\(\.saturn\)/);
 assert.match(read('sw.js'),/starry-shell-v39/);
 assert.match(read('battery-game-v18.js'),/targetId:id, sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
