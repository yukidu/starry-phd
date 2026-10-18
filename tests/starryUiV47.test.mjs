import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

test('all nine displayed planets form an even 40-degree loop; Mercury and Pluto are neighbors',()=>{
 const js=read('app-v5.js');
 const map=js.match(/const planetMap = \[([\s\S]*?)\];/);
 assert.ok(map);
 const yaws=[...map[1].matchAll(/yaw:\s*([\d.]+)/g)].map(m=>Number(m[1])).slice(0,9);
 assert.deepEqual(yaws,[0,40,80,120,160,200,240,280,320]);
 assert.equal((360-yaws[8]+yaws[0])%360,40);
 assert.match(js,/const fovX = portrait \? 138 : 112, fovY = 82/);
 assert.match(js,/window\.starryCenteredPlanetY\(p\.pitch/);
});
test('mobile portrait keeps around three linked cards visible across 360° headings',()=>{
 const ctx={window:{}};
 runInNewContext(read('navigation-safe-v44.js'),ctx);
 const centered=ctx.window.starryCenteredPlanetY;
 const planetMap=[
  [-23,1],[0,1],[23,1],[-23,1],[0,1],[23,1],[-23,0],[0,1],[23,1]
 ];
 const width=390,height=844,fovX=138,fovY=82;
 for(let yaw=0;yaw<360;yaw+=10){
  let count=0;
  for(let i=0;i<9;i++){
   const dyaw=((((i*40-yaw)+540)%360)+360)%360-180;
   if(!planetMap[i][1])continue;
   const x=width*.5+(dyaw/(fovX/2))*width*.5;
   const y=centered(planetMap[i][0],{width,height,headerBottom:180,groupHeight:173});
   if(x>=0&&x<=width&&y>200&&y<height-120)count++;
  }
  assert.ok(count>=2&&count<=4, 'heading '+yaw+' has '+count+' linked cards');
 }
});
test('top protection hides planet group before it touches website header/battery',()=>{
 const scope={window:{}};
 runInNewContext(read('navigation-safe-v44.js'),scope);
 const safe=scope.window.starrySafePlanetPosition;
 for(const vh of [680,844,920]){
  const viewport={width:390,height:vh,headerBottom:208};
  for(const y of [100,190,250,280]){
   const p={x:195,y,width:160,height:130};
   const result=safe(p,viewport);
   if(y-65<=Math.max(Math.min(210,Math.max(124,vh*.235)),220)){
      assert.equal(result.fade,0, 'group at y '+y+' cannot appear over header');
   }
   assert.equal(result.y,y,'never move planet independently');
  }
 }
 const app=read('app-v5.js');
 assert.match(app,/protectedHeaderBottom = Math\.max\(/);
 assert.match(app,/headerBottom:protectedHeaderBottom/);
});
test('planet names: 50% translucent, regular weight, closely above the planet',()=>{
 const css=read('universe-readability-v41.js');
 const block=css.split('.planet-wrap > .celestial-name{')[1]?.split('}')[0];
 assert.ok(block);
 assert.match(block,/font-weight:400!important/);
 assert.match(block,/rgba\(243,252,255,\.50\)/);
 assert.match(block,/margin-bottom:-3px!important/);
 assert.match(css,/\.planet-wrap\.p5 > \.celestial-name\{margin-bottom:0!important\}/);
});
test('service card shell duplicates Google login outline, gradient and top shine',()=>{
 const card=read('universe-readability-v41.js');
 const login=read('battery-game-v18.js');
 for(const token of [
  '1px solid rgba(105,232,255,.38)',
  'rgba(5,17,39,.98)',
  'rgba(5,8,24,.985) 58%',
  'rgba(25,8,46,.98)',
  'linear-gradient(90deg,transparent,#7df9ff,transparent)'
 ]){
  assert.ok(card.includes(token),'card missing '+token);
  assert.ok(login.includes(token),'login missing '+token);
 }
 assert.match(card,/\.planet-wrap em\.service-label::before/);
});
test('battery count matches left label font weight, size and color',()=>{
 const css=read('battery-game-v18.js');
 assert.match(css,/#starryBatteryCenter \.battery-title\{[^\n]+color:rgba\(179,229,255,\.82\);font:700 clamp\(14px,1\.5vw,18px\)\/1\.15 "Noto Sans TC"/);
 assert.match(css,/#starryBatteryCenter \.battery-value\{[^\n]+color:rgba\(179,229,255,\.82\);font:700 clamp\(14px,1\.5vw,18px\)\/1\.15 "Noto Sans TC"/);
 assert.ok(css.includes('#starryBatteryCenter .battery-value{font-size:14px}#starryBatteryCenter .battery-title{font-size:14px}'));
 assert.match(css,/#starryBatteryCenter \.battery-value\.login-ready/);
});
