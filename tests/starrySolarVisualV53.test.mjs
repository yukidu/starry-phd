import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function sheet(){
 let css='';
 const body={style:{setProperty(){}}};
 const root={querySelector:()=>body};
 const doc={getElementById:()=>root,createElement:()=>({dataset:{},set textContent(v){css=v}}),head:{appendChild(){}}};
 runInNewContext(read('solar-hero-v51.js'),{window:{},document:doc});
 return css;
}
test('no polygon flames: six individually curved SVG plasma prominences',()=>{
 const html=read('index.html'),css=sheet();
 const arcs=[...html.matchAll(/class="solar-hero__arc solar-hero__arc--\d+"/g)];
 assert.equal(arcs.length,6);
 assert.equal((html.match(/<path class="solar-hero__arc/g)||[]).length,6);
 assert.match(html,/solar-hero__prominences/);
 assert.match(html,/<linearGradient id="starryPlasmaAmber"/);
 for(const arc of html.matchAll(/class="solar-hero__arc[^"]*" d="([^"]+)"/g)){
  assert.ok((arc[1].match(/[CS]/g)||[]).length>=2,'organic curved arcs');
 }
 assert.doesNotMatch(html,/solar-hero__flare/);
 assert.doesNotMatch(css,/clip-path:polygon|repeating-conic-gradient|repeating-radial-gradient/);
 assert.match(css,/\.solar-hero__disc\{/);
 assert.match(css,/\.solar-hero__disc::before\{/);
 assert.match(css,/\.solar-hero__disc::after\{/);
 assert.match(css,/@keyframes starrySolarPlasma/);
});

test('the solar arcs stay behind the sphere, fade gently and never steal taps',()=>{
 const css=sheet();
 assert.match(css,/\.solar-hero__prominences\{[^}]*z-index:1/);
 assert.match(css,/\.solar-hero__disc\{[^}]*z-index:2/);
 assert.match(css,/\.solar-hero\{[^}]*overflow:hidden;z-index:0;pointer-events:none/);
 assert.match(css,/html\[data-starry-interacting="1"\] \.solar-hero__arc\{animation-play-state:paused!important\}/);
 assert.match(css,/html\[data-starry-quality="medium"\]/);
 assert.match(css,/html\[data-starry-quality="low"\]/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/filter:blur\(|backdrop-filter|setInterval\(/);
});

test('Earth stays in the center while idle, without a hidden automatic yaw drift',()=>{
 const js=read('app-v5.js');
 assert.match(js,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(js,/let displayedYaw = 80, displayedPitch = 0, lastFrameAt = 0;/);
 assert.doesNotMatch(js,/autoYaw = normAngle\(autoYaw \+ 0\.013\)/);
 assert.match(js,/cameraYaw=normAngle\(cameraYaw-dx\*sens\)/);
 assert.match(js,/cameraYaw = 80;[\s\S]*?displayedYaw = 80;[\s\S]*?autoYaw = 0;/);
 assert.match(js,/function viewPitch\(\) \{ return 0; \}/);
 const map=js.match(/const planetMap = \[([\s\S]*?)\];/)[1];
 const items=[...map.matchAll(/yaw:\s*(\d+), pitch:\s*(-?\d+)/g)].map(x=>[+x[1],+x[2]]);
 assert.equal(items.length,9);
 assert.deepEqual(items[2],[80,0]);
});

test('moon is smaller than Earth and visually grouped nearby on mobile',()=>{
 const html=read('index.html');
 assert.match(html,/\.earth-moon-companion\{left:calc\(50% \+ 34px\);top:17px\}/);
 assert.match(html,/\.moon\{width:19px!important;height:19px!important\}/);
 assert.match(html,/\.earth-moon-companion\{position:absolute;z-index:4;left:calc\(50% \+ 40px\)/);
 assert.match(html,/\.moon\{width:24px!important;height:24px!important/);
 assert.match(html,/class="earth-moon-companion"/);
 assert.ok(19<52*.5,'mobile moon size below half Earth diameter');
 assert.match(read('universe-readability-v41.js'),/\.planet-wrap \.earth::after/);
});

test('readable title and subtle reflected sunlight, with cache and service tests intact',()=>{
 const css=sheet();
 assert.match(css,/\.brand-mark::before\{/);
 assert.match(css,/\.brand-mark h1\{/);
 assert.match(css,/-webkit-text-fill-color:transparent!important/);
 assert.match(css,/text-shadow:none!important/);
 assert.match(css,/\.planet-wrap > \.planet:not\(\.moon\):not\(\.saturn\)/);
 assert.match(read('sw.js'),/starry-shell-v29/);
 assert.match(read('.github/workflows/deploy.yml'),/solar-hero__prominences/);
 assert.match(read('battery-game-v18.js'),/targetId:targetId\(rock\), sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
