import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function makeLayout(){
  const context={window:{}};
  runInNewContext(read('planet-card-layout-v42.js'),context);
  return context.window.starryArrangePlanetCards;
}
function overlap(a,b){
  return Math.abs(a.x-b.x)*2<a.width+b.width+20 &&
    Math.abs(a.y-b.y)*2<a.height+b.height+20;
}
test('mobile neighboring planet information cards never overlap',()=>{
  const solve=makeLayout();
  const entries=[
    {id:0,visible:true,x:185,y:370,width:210,height:146,depth:.98},
    {id:1,visible:true,x:205,y:390,width:195,height:154,depth:.91},
    {id:2,visible:true,x:145,y:430,width:185,height:143,depth:.79},
    {id:3,visible:true,x:210,y:480,width:170,height:126,depth:.69}
  ];
  const result=solve(entries,{width:393,height:780});
  const visible=result.filter(x=>x.visible);
  assert.ok(visible.length>=1);
  for(const a of visible){
    assert.ok(a.x-a.width/2>=11,'left card edge visible');
    assert.ok(a.x+a.width/2<=382,'right card edge visible');
    assert.ok(a.y-a.height/2>=112,'top reserve');
    assert.ok(a.y+a.height/2<=676,'bottom shop reserve');
    for(const b of visible)if(b.id>a.id)assert.equal(overlap(a,b),false);
  }
});
test('names and service cards are kept as whole groups, not detached',()=>{
  const solve=makeLayout();
  const projected=[
    {id:0,visible:true,x:1,y:420,width:190,height:150,depth:1},
    {id:1,visible:true,x:500,y:430,width:200,height:145,depth:.9},
    {id:2,visible:false,x:210,y:430,width:190,height:150,depth:1}
  ];
  const result=solve(projected,{width:393,height:780});
  assert.equal(result.length,3);
  assert.equal(result[0].visible,true);
  assert.ok(result[0].x-result[0].width/2>=11);
  assert.equal(result[1].visible,false);
  assert.equal(result[2].visible,false);
  assert.deepEqual(projected[0],{id:0,visible:true,x:1,y:420,width:190,height:150,depth:1});
});
test('mobile cards fit text width and preserve the large Chinese and URL fonts',()=>{
  const css=read('universe-readability-v41.js');
  assert.match(css,/width:max-content!important/);
  assert.match(css,/min-width:0!important/);
  assert.match(css,/padding:10px 12px!important/);
  assert.match(css,/font-size:21px!important/);
  assert.match(css,/font-size:13px!important/);
  assert.match(css,/planet-wrap\.p5 > \.celestial-name/);
  assert.match(css,/planet-wrap\.p6 > \.celestial-name/);
});
test('main render uses cached card sizes and same-group collision positions',()=>{
  const app=read('app-v5.js');
  assert.match(app,/let planetSizes = null/);
  assert.match(app,/offsetWidth \+ 12/);
  assert.match(app,/window\.starryArrangePlanetCards\(positions, \{ width, height \}\)/);
  assert.match(app,/el\.style\.transform = `translate3d/);
  assert.match(read('interaction-v16.js'),/nativeLink\.href = url/);
});
