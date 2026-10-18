import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const meteor=read('meteor-v14.js');
const app=read('app-v5.js');

test('V60 explosion has a bounded glow without expensive wide shadows',()=>{
 const css=meteor.slice(meteor.indexOf('    .meteor-hit-explosion{'),meteor.indexOf('  document.head.appendChild(style);'));
 const flash=css.split('    .meteor-hit-explosion{')[1].split('    .meteor-hit-explosion::before{')[0];
 assert.match(flash,/width:32px;/);
 assert.match(flash,/height:32px;/);
 assert.match(flash,/box-shadow:none!important;/);
 assert.match(flash,/filter:none!important;/);
 assert.match(flash,/animation:meteorExplosionCore \.38s/);
 assert.doesNotMatch(flash,/110px|165px|box-shadow:0 0|filter:blur/);
 assert.match(css,/\.meteor-hit-explosion::after\{content:none!important\}/);
 assert.match(css,/\.meteor-hit-shard\{[\s\S]*?filter:none!important;[\s\S]*?box-shadow:none!important/);
 assert.match(css,/@keyframes meteorExplosionCore\{[\s\S]*?scale\(1\.8\)/);
 assert.match(css,/@keyframes meteorExplosionRing\{[\s\S]*?scale\(2\.25\)/);
});
function createBurstHarness(quality){
 const explosions=[];
 let scheduled=0,cancelled=0,lookups=0,nodes=0;
 const doc={
   querySelectorAll(){lookups++;throw Error('Unexpected full-page scan in explosion path');},
   createElement(tag){nodes++;
     return {tag,className:'',children:[],style:{setProperty(){},left:'',top:''},
       appendChild(child){this.children.push(child)},
       remove(){const i=explosions.indexOf(this);if(i!==-1)explosions.splice(i,1)}
     };
   },
   body:{appendChild(el){explosions.push(el)}}
 };
 const code='let activeBurst = null;let burstRemovalTimer = null;function createExplosion(x, y) {'+
   meteor.split('  function createExplosion(x, y) {')[1].split('\n  function explodeMeteor(')[0];
 const ctx={document:doc,window:{starryPerformance:{getTier:()=>quality}},
   Math,setTimeout(){scheduled++;return scheduled},clearTimeout(){cancelled++}};
 runInNewContext(code+';this.createExplosion=createExplosion;',ctx);
 return {blast:ctx.createExplosion,explosions,stats:()=>({scheduled,cancelled,lookups,nodes})};
}
test('150 rapid blasts keep one lightweight effect, with no page scans or timer backlog',()=>{
 const fx=createBurstHarness('high');
 for(let i=0;i<150;i++){
   fx.blast(15+i,120);
   assert.equal(fx.explosions.length,1);
   assert.equal(fx.explosions[0].children.length,8);
 }
 const st=fx.stats();
 assert.equal(st.lookups,0);
 assert.equal(st.nodes,150*9);
 assert.equal(st.cancelled,149);
 assert.equal(st.scheduled,150);
});
test('adaptive shards preserve meteor rewards and audio for each hit',()=>{
 for(const [quality,n] of [['eco',2],['low',3],['medium',5],['high',8]]){
  const fx=createBurstHarness(quality);
  fx.blast(50,50);
  assert.equal(fx.explosions[0].children.length,n);
 }
 assert.match(meteor,/playExplosionSound\(\);/);
 assert.match(meteor,/window\.dispatchEvent\(new CustomEvent\('starry:meteor-blasted'/);
 assert.match(read('battery-game-v18.js'),/targetId:targetId\(rock\), sizeLevel/);
 assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
test('reuse one audio noise buffer for 50 booms with 100 source starts',()=>{
 let buffers=0,starts=0,contexts=0;
 const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},value:0});
 const node=()=>({gain:param(),frequency:param(),Q:{value:0},connect(){},disconnect(){},start(){starts++},stop(){},onended:null});
 class AC{
   constructor(){contexts++;this.currentTime=0;this.sampleRate=22050;this.destination={};this.state='running'}
   createGain(){return node()}
   createOscillator(){return node()}
   createBuffer(ch,length){buffers++;return {getChannelData(){return new Float32Array(length)}}}
   createBufferSource(){return node()}
   createBiquadFilter(){return node()}
 }
 const audioSrc='let meteorAudioContext=null;let meteorNoiseBuffer=null;'+
  'function ensureMeteorAudio() {'+
  meteor.split('  function ensureMeteorAudio() {')[1].split('\n  function createExplosion(')[0];
 const ctx={window:{AudioContext:AC},Math};
 runInNewContext(audioSrc+';this.playExplosionSound=playExplosionSound;',ctx);
 for(let i=0;i<50;i++)ctx.playExplosionSound();
 assert.equal(contexts,1);
 assert.equal(buffers,1);
 assert.equal(starts,100);
});
test('meteor blast avoids generic twelve-spark click while ordinary clicks remain',()=>{
 assert.match(app,/addEventListener\('starry:meteor-blasted', \(\) => \{/);
 assert.match(app,/lastMeteorBlastAt = performance\.now\(\)/);
 assert.match(app,/if \(now - lastMeteorBlastAt < 220\) return;/);
 assert.doesNotMatch(app,/for\(let i=0;i<12;i\+\+\)/);
 assert.match(app,/currentClickRing=ring;/);
 assert.match(read('index.html'),/\.universe > #meteorLayer\{position:absolute;inset:0;z-index:1;overflow:visible;pointer-events:none\}/);
 assert.match(read('index.html'),/\.universe > \.planet-lane\{z-index:2;pointer-events:none\}/);
 assert.match(read('sw.js'),/starry-shell-v36/);
});
