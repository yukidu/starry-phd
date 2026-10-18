import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function getCss(){
 let css='';
 const root={querySelector:()=>({style:{setProperty(){}}})};
 const document={getElementById:()=>root,createElement:()=>({dataset:{},set textContent(v){css=v}}),head:{appendChild(){}}};
 runInNewContext(read('solar-hero-v51.js'),{window:{},document});
 return css;
}
test('sunspots shrink, soften and vary in size without black holes',()=>{
 const css=getCss();
 assert.match(css,/ellipse 1\.55% 1\.15% at 25% 82%,rgba\(111,40,19,\.47\)/);
 assert.match(css,/ellipse \.8% \.7% at 26\.4% 82\.8%,rgba\(112,42,23,\.36\)/);
 assert.match(css,/ellipse 1\.2% \.95% at 68% 88%,rgba\(108,36,21,\.48\)/);
 assert.match(css,/ellipse \.85% \.6% at 69\.3% 88\.7%,rgba\(119,45,24,\.30\)/);
 assert.doesNotMatch(css,/rgba\(49,8,11,\.9\)|rgba\(47,7,10,\.88\)/);
 assert.match(css,/\.solar-hero__disc::before\{/);
 assert.match(css,/\.solar-hero__disc::after\{/);
});
test('brighter gold and wider orange corona remain static behind the planet layer',()=>{
 const css=getCss();
 assert.match(css,/\.solar-hero__corona\{\s*position:absolute;inset:-24%;z-index:0/);
 assert.match(css,/rgba\(255,241,166,\.88\)/);
 assert.match(css,/rgba\(255,208,86,\.79\)/);
 assert.match(css,/rgba\(255,159,35,\.64\)/);
 assert.match(css,/rgba\(242,66,11,\.33\)/);
 assert.match(css,/0 0 165px 74px rgba\(252,81,12,\.30\)/);
 assert.match(css,/0 0 128px 61px rgba\(247,76,10,\.28\)/);
 assert.match(css,/\.solar-hero\{[\s\S]*?overflow:hidden;z-index:0;pointer-events:none/);
 assert.match(css,/\.planet-lane\{z-index:1\}/);
 assert.doesNotMatch(css,/@keyframes|solar-hero__arc|solar-hero__flare|backdrop-filter/);
 assert.doesNotMatch(read('solar-hero-v51.js'),/setInterval\(|requestAnimationFrame\(|fetch\(/);
});
test('sun diameter/height and existing parallax, heading, click effects stay unchanged',()=>{
 const css=getCss(),app=read('app-v5.js'),html=read('index.html');
 assert.match(css,/transform:translate3d\(calc\(-50% \+ var\(--starry-solar-x,0px\)\),-67\.5%,0\)/);
 assert.match(css,/@media\(max-width:760px\)\{\s*\.solar-hero__body\{width:180vw\}/);
 assert.match(css,/-webkit-text-stroke:\.95px rgba\(255,148,32,\.92\)!important/);
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(app,/function viewPitch\(\) \{ return 0; \}/);
 assert.match(html,/\.earth-moon-companion\{left:calc\(50% \+ 34px\);top:17px\}/);
 assert.match(html,/\.moon\{width:19px!important;height:19px!important\}/);
 assert.match(html,/\.click-burst\{/);
 assert.match(html,/\.click-spark\{/);
 assert.match(read('sw.js'),/starry-shell-v38/);
 assert.match(read('battery-game-v18.js'),/targetId:id, sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
