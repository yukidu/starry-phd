import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app-v5.js'),battery=read('battery-game-v18.js'),mod=read('starry-battery-charge-v1.js');

test('responsive planet scale keeps phones 1x and fits tablet and desktop',()=>{
 const scope={window:{}};
 runInNewContext(read('navigation-safe-v44.js'),scope);
 const fn=scope.window.starryAdaptivePlanetScale;
 const sc=(width,height,headerBottom=175)=>fn({width,height,headerBottom,groupWidth:200,groupHeight:220});
 assert.equal(sc(390,844),1);
 assert.equal(sc(760,1200),1);
 assert.ok(sc(768,1024)>1 && sc(768,1024)<2);
 assert.ok(sc(1024,768)>1 && sc(1024,768)<=2);
 assert.equal(sc(1920,1080),2);
 assert.equal(sc(1440,900),2);
 assert.ok(sc(1180,540)<1.5);
 assert.equal(sc(1920,1080,850),1);
});
test('one wrapper scale includes sphere/title/service card and measured safe bounds',()=>{
 assert.match(app,/planetDisplayScale = window\.starryAdaptivePlanetScale/);
 assert.match(app,/groupWidth:maxPlanetGroupWidth,groupHeight:maxPlanetGroupHeight/);
 assert.match(app,/groupHeight:maxPlanetGroupHeight\*planetDisplayScale/);
 assert.match(app,/width:bounds\.width\*planetDisplayScale,height:bounds\.height\*planetDisplayScale/);
 assert.ok(app.includes('translate(-50%,-50%) scale('+'$'+'{planetDisplayScale})'));
 assert.match(app,/el\.style\.pointerEvents = onScreen && el\.dataset\.url \? 'auto' : 'none'/);
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(app,/yaw: 320, pitch: 23, size: \.88/);
});
function setup(reduced=false){
 const styles=new Map(),animations=[],cancels=[];
 const document={
  getElementById:id=>styles.get(id)||null,
  createElement:tag=>({id:'',tag,textContent:''}),
  createElementNS:(ns,tag)=>{
   const el={tag,attributes:{},classList:{add(n){el.className=n}},
    setAttribute(k,v){this.attributes[k]=v},
    getAnimations(){return this.running||[]},
    animate(frames,options){const anim={cancel(){cancels.push(1)}};this.running=[anim];animations.push({frames,options});return anim},
    remove(){this.removed=true}};
   return el;
  },
  head:{appendChild:el=>styles.set(el.id,el)}
 };
 const window={matchMedia:()=>({matches:reduced})};
 runInNewContext(mod,{window,document});
 const host={children:[],appendChild(el){this.children.push(el)}};
 return {api:window.StarryBatteryCharge,host,styles,animations,cancels};
}
test('shared v1 SVG flashes 200 times without stacking; 124x144 visual size',()=>{
 const h=setup(),bolt=h.api.mount(h.host);
 assert.equal(h.styles.size,1);
 assert.equal(h.host.children.length,1);
 assert.equal(bolt.className,'starry-battery-charge-bolt');
 assert.equal(bolt.attributes['aria-hidden'],'true');
 assert.match([...h.styles.values()][0].textContent,/width:124px;height:144px/);
 assert.match(bolt.innerHTML,/fill="#9dff35"/);
 for(let i=0;i<200;i++)assert.equal(h.api.flash(bolt),true);
 assert.equal(h.animations.length,200);
 assert.equal(h.cancels.length,199);
 assert.equal(h.animations[0].options.duration,540);
 h.api.remove(bolt);
 assert.equal(h.cancels.length,200);
 assert.equal(bolt.removed,true);
 assert.doesNotMatch(mod,/fetch\(|XMLHttpRequest|id\.starry\.phd/);
});
test('reduced motion uses short flash; unavailable animation degrades safely',()=>{
 const h=setup(true),bolt=h.api.mount(h.host);
 h.api.flash(bolt);
 assert.equal(h.animations[0].options.duration,220);
 assert.equal(h.animations[0].frames.length,3);
 assert.equal(h.api.flash({getAnimations:()=>[]}),false);
 assert.equal(h.api.flash(null),false);
});
test('signed-in number is clean gold without yellow glow; guest button unchanged',()=>{
 assert.match(battery,/#starryBatteryCenter\{[^\n]*color:#fff4a9;text-shadow:none;user-select:none/);
 assert.match(battery,/#starryBatteryCenter \.battery-value\{[^\n]*color:#fff4a9;[^\n]*text-shadow:none;overflow:visible/);
 assert.match(battery,/#starryBatteryCenter \.battery-value:not\(\.login-ready\)\{[^\n]*background:transparent!important;[^\n]*text-shadow:none!important/);
 assert.match(battery,/#starryBatteryCenter \.battery-value\.login-ready\{[^\n]*background:linear-gradient/);
 assert.match(battery,/window\.StarryBatteryCharge\?\.mount\(batteryIcon\)/);
 assert.match(battery,/window\.StarryBatteryCharge\?\.flash\(chargeBolt\)/);
 assert.match(battery,/optimisticAwards\.set\(id, cents\)/);
 assert.match(battery,/currentBalance = number; \/\/ Always display the confirmed server ledger\./);
});
test('portable documentation, PWA and workflows include independent helper',()=>{
 const guide=read('docs/starry-battery-charge.md');
 assert.match(guide,/StarryBatteryCharge\.mount/);
 assert.match(guide,/StarryBatteryCharge\.flash/);
 assert.match(guide,/不包含 Starry ID/);
 assert.match(guide,/本次 #64.*只在繁星艦長/);
 assert.match(read('sw.js'),/starry-shell-v40/);
 for(const p of ['.github/workflows/pr-check.yml','.github/workflows/deploy.yml']){
  assert.match(read(p),/starry-battery-charge-v1\.js battery-game-v18\.js/);
 }
});
