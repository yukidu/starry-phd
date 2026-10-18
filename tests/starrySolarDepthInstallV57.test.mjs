import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function solarCss(){
 let css='';
 const root={querySelector:()=>({style:{setProperty(){}}})};
 const doc={getElementById:()=>root,createElement:()=>({dataset:{},set textContent(v){css=v}}),head:{appendChild(){}}};
 runInNewContext(read('solar-hero-v51.js'),{document:doc,window:{}});
 return css;
}
function centered(){
 const window={};
 runInNewContext(read('navigation-safe-v44.js'),{window});
 return window.starryCenteredPlanetY;
}
function installFixture({standalone=false,isIos=false}={}){
 const cb={};
 const modal={opened:false,classList:{add(){modal.opened=true}},setAttribute(){}};
 const message={textContent:''};
 let click;
 const button={addEventListener:(name,fn)=>{if(name==='click')click=fn}};
 const doc={
  querySelector:selector=>selector.includes('Google Play')?button:null,
  getElementById:id=>id==='portalModal'?modal:id==='portalMessage'?message:null,
  createElement:()=>({setAttribute(){}}),head:{appendChild(){}}
 };
 const window={};
 const navigator={userAgent:isIos?'iPhone':'Chrome Android',platform:isIos?'iPhone':'Linux',standalone:false};
 const ctx={window,document:doc,navigator,matchMedia:()=>({matches:standalone}),addEventListener:(name,fn)=>{cb[name]=fn},dispatchEvent(){},CustomEvent:class{},console};
 runInNewContext(read('pwa-v25.js'),ctx);
 return {cb,modal,window,click:async()=>{await click({preventDefault(){},stopImmediatePropagation(){}});return message.textContent}};
}
test('whole solar sphere is softly defocused without blurring planets',()=>{
 const css=solarCss();
 assert.match(css,/\.solar-hero__disc\{[\s\S]*?filter:blur\(12px\)/);
 assert.match(css,/html\[data-starry-quality="medium"\] \.solar-hero__disc\{filter:blur\(8px\)\}/);
 assert.match(css,/html\[data-starry-quality="low"\] \.solar-hero__disc\{filter:blur\(6px\)\}/);
 assert.match(css,/\.solar-hero__corona\{[\s\S]*?inset:-24%/);
 assert.match(css,/rgba\(255,241,166,\.88\)/);
 assert.match(css,/rgba\(255,159,35,\.64\)/);
 assert.match(css,/rgba\(242,66,11,\.33\)/);
 assert.match(css,/transform:translate3d\(calc\(-50% \+ var\(--starry-solar-x,0px\)\),-67\.5%,0\)/);
 assert.match(css,/@media\(max-width:760px\)\{\s*\.solar-hero__body\{width:180vw\}/);
 assert.doesNotMatch(css,/\.planet-lane\{[^}]*blur|@keyframes|solar-hero__flare/);
});
test('logo loses dark frame and becomes rich gold-orange metallic',()=>{
 const css=solarCss();
 assert.match(css,/\.brand-mark::before\{content:none!important;display:none!important;background:none!important;box-shadow:none!important\}/);
 assert.match(css,/linear-gradient\(180deg,#fff4b9 0%,#ffbc38 14%,#ff7b12 30%,#d34d09 39%/);
 assert.match(css,/-webkit-text-stroke:\.95px rgba\(255,148,32,\.92\)!important/);
 assert.match(css,/drop-shadow\(0 0 11px rgba\(255,140,15,\.87\)\)/);
});
test('upper planet lane rises no more than 15px and cannot cover header or battery',()=>{
 const y=centered();
 for(const [w,h,header,g] of [[390,844,180,173],[375,667,180,160],[320,568,160,155],[1280,720,90,190]]){
  const v={width:w,height:h,headerBottom:header,groupHeight:g};
  const [upper,mid,lower]=[23,0,-23].map(p=>y(p,v));
  const rise=2*mid-upper-lower;
  assert.ok(rise>=0&&rise<=15.001,'15px cap '+w+'x'+h);
  assert.ok(upper-g/2>=header+9.9,'no header/battery overlap '+w+'x'+h);
  assert.ok(upper<mid&&mid<lower);
 }
 assert.match(read('app-v5.js'),/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(read('app-v5.js'),/function viewPitch\(\) \{ return 0; \}/);
});
test('balance uses meteor yellow while the login action stays cyan',()=>{
 const js=read('battery-game-v18.js');
 assert.match(js,/#starryBatteryCenter \.battery-title\{[^\n]+color:#fff4a9/);
 assert.match(js,/#starryBatteryCenter \.battery-value\{[^\n]+color:#fff4a9/);
 assert.match(js,/#starryBatteryCenter \.battery-value:disabled\{opacity:1;color:#fff4a9/);
 assert.match(js,/\.battery-reward-float\{[^\n]+color:#fff4a9/);
 assert.match(js,/#starryBatteryCenter \.battery-value\.login-ready\{[^\n]+color:#eaffff/);
 assert.match(js,/targetId:targetId\(rock\), sizeLevel/);
});
test('Google Play shows 已安裝 when proven by standalone context',async()=>{
 const fx=installFixture({standalone:true});
 assert.match(await fx.click(),/已安裝繁星艦長/);
 assert.ok(fx.modal.opened);
});
test('browser appinstalled event proves installation too',async()=>{
 const fx=installFixture();
 fx.cb.appinstalled();
 assert.match(await fx.click(),/已安裝繁星艦長/);
});
test('regular browser without evidence never falsely reports installed',async()=>{
 const fx=installFixture();
 const msg=await fx.click();
 assert.match(msg,/無法確認是否已安裝/);
 assert.doesNotMatch(msg,/^已安裝繁星艦長/);
});
test('iPhone shows supported installation guidance instead of doing nothing',async()=>{
 const fx=installFixture({isIos:true});
 assert.match(await fx.click(),/iPhone\/iPad/);
});
test('click burst, moon, nine planet order and PWA cache stay intact',()=>{
 const html=read('index.html'),app=read('app-v5.js');
 assert.match(html,/\.click-burst\{/);
 assert.match(html,/\.click-spark\{/);
 assert.match(html,/\.moon\{width:19px!important;height:19px!important\}/);
 const yaw=[...app.match(/const planetMap = \[([\s\S]*?)\];/)[1].matchAll(/yaw:\s*(\d+)/g)].map(m=>+m[1]);
 assert.deepEqual(yaw,[0,40,80,120,160,200,240,280,320]);
 assert.match(read('sw.js'),/starry-shell-v33/);
 assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v33/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
