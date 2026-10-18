import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('battery-game-v18.js');

function harness({initial=10,reduced=false}={}){
 const events=[],calls=[],flashes=[],cancels=[],rewards=[];
 const classes=new Set();
 const value={textContent:'',disabled:true,
   classList:{contains:s=>classes.has(s),add:s=>classes.add(s),remove:s=>classes.delete(s)},
   setAttribute(){}};
 let animations=[];
 const chargeBolt={
   getAnimations(){return animations},
   animate(frames,options){
     const anim={cancel(){cancels.push(1)}};
     animations=[anim];flashes.push({frames,options});return anim;
   }
 };
 class Rock{constructor(id,cents){this.dataset={batteryTargetId:id,batteryRewardHundredths:String(cents),batterySizeLevel:'4'};}}
 class Event{constructor(type,options){this.type=type;this.detail=options.detail}}
 const ctx={
   value,chargeBolt,HTMLElement:Rock,CustomEvent:Event,
   matchMedia:()=>({matches:reduced}),window:{
     dispatchEvent:e=>{events.push(e);return true},
     matchMedia:()=>({matches:reduced})
   },
   console:{warn(){}},Math,Array,Number,Map,
   addEventListener(){},
   api:(method,body)=>new Promise((resolve,reject)=>calls.push({method,body,resolve,reject})),
   targetId:rock=>rock.dataset.batteryTargetId,
   showReward:(x,y,amount,rock)=>rewards.push({x,y,amount,rock})
 };
 // Real shared component runs inside the VM; the reward harness passes a
 // mock SVG that counts animations, preserving real cancellation behavior.
 runInNewContext(read('starry-battery-charge-v1.js'),{
   window:ctx.window,document:{getElementById:()=>null,
     createElement:()=>({}),head:{appendChild(){}}}
 });
 const a=source.indexOf('  function renderBalance() {'),b=source.indexOf("  value.addEventListener('click'",a);
 const c=source.indexOf('  function failReward(rock) {'),d=source.indexOf('\n  void loadBalance();',c);
 assert.ok(a>=0&&b>a&&c>=0&&d>c);
 const script='let currentBalance='+initial+';'+
  'const optimisticAwards=new Map(),rewardQueue=[];'+
  'let rewardQueueRunning=false,balanceGeneration=0,balanceReadSequence=0,activeRewardRequests=0;'+
  source.slice(a,b)+source.slice(c,d)+
  'this.methods={hit:rewardMeteor,render:renderBalance,state:()=>({currentBalance,pending:optimisticAwards.size,queue:rewardQueue.length,activeRewardRequests,balanceGeneration})};';
 runInNewContext(script,ctx);
 ctx.methods.render();
 return {
  hit:(id,cents)=>{const rock=new Rock(id,cents);ctx.methods.hit(rock,40,80);return rock},
  value,events,calls,flashes,cancels,rewards,state:ctx.methods.state,
  resolve:(i,{balance,added=0,duplicate=false,status=200,success=true})=>{
    assert.ok(calls[i]);calls[i].resolve({response:{status,ok:status>=200&&status<300},data:{success,balance,added,duplicate}});
  },
  flush:async()=>{for(let i=0;i<6;i++)await Promise.resolve();}
 };
}
test('signed-in battery has no background, guest login button retains its design',()=>{
 assert.match(source,/#starryBatteryCenter\{background:none!important;border:0!important;box-shadow:none!important\}/);
 assert.match(source,/#starryBatteryCenter \.battery-value:not\(\.login-ready\)\{[^\n]+background:transparent!important;[^\n]+border:0!important;[^\n]+box-shadow:none!important/);
 assert.match(source,/#starryBatteryCenter \.battery-value\.login-ready\{[^\n]*background:linear-gradient/);
 assert.match(source,/batteryIcon\.textContent = '🔋'/);
 assert.match(source,/window\.StarryBatteryCharge\?\.mount\(batteryIcon\)/);
 assert.match(read('starry-battery-charge-v1.js'),/stroke="#28ee91"/);
 assert.match(read('starry-battery-charge-v1.js'),/width:124px;height:144px/);
});
test('three rapid hits update instantly and POST one at a time with no double counts',async()=>{
 const h=harness(),a=h.hit('A',15);
 assert.equal(h.value.textContent,'10.15 顆');
 h.hit('B',20);h.hit('C',5);
 assert.equal(h.value.textContent,'10.40 顆');
 assert.equal(h.calls.length,1);
 assert.equal(h.flashes.length,3);
 assert.equal(h.cancels.length,2);
 assert.equal(h.state().activeRewardRequests,3);
 h.resolve(0,{balance:10.15,added:.15});await h.flush();
 assert.equal(h.value.textContent,'10.40 顆');
 assert.equal(h.calls.length,2);
 h.resolve(1,{balance:10.35,added:.20});await h.flush();
 assert.equal(h.value.textContent,'10.40 顆');
 assert.equal(h.calls.length,3);
 h.resolve(2,{balance:10.40,added:.05});await h.flush();
 assert.equal(h.value.textContent,'10.40 顆');
 assert.equal(h.state().pending,0);
 assert.equal(h.state().activeRewardRequests,0);
 assert.equal(h.rewards.length,3);
 assert.deepEqual(h.calls.map(c=>c.method),['POST','POST','POST']);
 assert.deepEqual(h.calls.map(c=>c.body.targetId),['A','B','C']);
 assert.equal(a.dataset.batteryRewardSent,'1');
});
test('failed reward rolls back only itself and preserves later pending hits',async()=>{
 const h=harness();h.hit('A',20);h.hit('B',15);
 assert.equal(h.value.textContent,'10.35 顆');
 h.resolve(0,{status:429,success:false});await h.flush();
 assert.equal(h.value.textContent,'10.15 顆');
 assert.equal(h.calls.length,2);
 h.resolve(1,{balance:10.15,added:.15});await h.flush();
 assert.equal(h.value.textContent,'10.15 顆');
 assert.equal(h.state().pending,0);
 assert.equal(h.events.filter(e=>e.type==='starry:meteor-reward-failed').length,1);
});
test('duplicate target ID is not awarded despite its initial on-screen estimate',async()=>{
 const h=harness();h.hit('one',30);h.hit('two',20);
 assert.equal(h.value.textContent,'10.50 顆');
 h.resolve(0,{balance:10,added:0,duplicate:true});await h.flush();
 assert.equal(h.value.textContent,'10.20 顆');
 h.resolve(1,{balance:10.2,added:.2});await h.flush();
 assert.equal(h.value.textContent,'10.20 顆');
 assert.equal(h.rewards.length,1);
});
test('unauthorized server reply clears optimistic totals and skips queued requests',async()=>{
 const h=harness();h.hit('a',10);h.hit('b',15);h.hit('c',30);
 h.resolve(0,{status:401,success:false});await h.flush();
 assert.equal(h.value.textContent,'請先登入');
 assert.equal(h.state().pending,0);
 assert.equal(h.state().activeRewardRequests,0);
 assert.equal(h.calls.length,1);
 assert.equal(h.events.filter(e=>e.type==='starry:meteor-reward-failed').length,3);
});
test('100 consecutive hits add exact cents without extra requests or duplicate effects',()=>{
 const h=harness();
 for(let i=0;i<100;i++)h.hit('tap'+i,3);
 assert.equal(h.value.textContent,'13.00 顆');
 assert.equal(h.state().pending,100);
 assert.equal(h.calls.length,1);
 assert.equal(h.flashes.length,100);
 assert.equal(h.cancels.length,99);
});
test('lightning supports reduced motion and fails safely without WAAPI',()=>{
 const h=harness({reduced:true});h.hit('A',10);
 assert.equal(h.flashes[0].options.duration,220);
 assert.match(read('starry-battery-charge-v1.js'),/typeof bolt\.animate !== 'function'/);
 assert.match(read('starry-battery-charge-v1.js'),/@media\(prefers-reduced-motion:reduce\)/);
});
test('unchanged backend, server-authoritative balance, independent PWA and galaxy',()=>{
 assert.match(source,/https:\/\/id\.starry\.phd\/api\/starry-game\/battery/);
 assert.match(source,/targetId:id, sizeLevel/);
 assert.match(source,/balanceGeneration\+\+/);
 assert.match(source,/sequence !== balanceReadSequence \|\| activeRewardRequests/);
 assert.match(source,/currentBalance = number; \/\/ Always display the confirmed server ledger/);
 assert.match(read('meteor-v14.js'),/starry:meteor-blasted/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
 assert.match(read('sw.js'),/starry-shell-v39/);
 assert.match(read('visual-v15.js'),/html\[data-starry-quality="eco"\] \.milky-way\{filter:none!important;animation:none!important/);
});
