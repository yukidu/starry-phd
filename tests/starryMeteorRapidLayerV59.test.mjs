import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const css=read('styles.css');
const guard=read('rapid-tap-guard-v30.js');
const meteor=read('meteor-v14.js');
const feedback=read('meteor-feedback-v27.js');

test('meteors are rendered between solar layer and planet/card layer without duplicate IDs',()=>{
  assert.equal((html.match(/id="meteorLayer"/g)||[]).length,1);
  const universe=html.indexOf('<div class="universe">');
  const sun=html.indexOf('id="starrySolarHero"');
  const meteors=html.indexOf('id="meteorLayer"');
  const planets=html.indexOf('id="planetLane"');
  assert.ok(universe>=0&&universe<sun&&sun<meteors&&meteors<planets);
  assert.match(html,/\.universe > #meteorLayer\{position:absolute;inset:0;z-index:1;overflow:visible;pointer-events:none\}/);
  assert.match(html,/\.universe > \.planet-lane\{z-index:2;pointer-events:none\}/);
  assert.match(css,/\.universe \{ z-index: 3; pointer-events: none; overflow: hidden/);
  assert.match(css,/\.meteor-layer \{ z-index: 2; overflow: hidden; pointer-events: none; \}/);
  assert.match(meteor,/\.space-rock\.small\[data-interactive-meteor="1"\]\{\s*pointer-events:auto!important/);
  assert.match(read('solar-hero-v51.js'),/\.solar-hero\{\\n position:absolute;inset:0;overflow:hidden;z-index:0/);
});
test('explosion and generic click sparks are no longer paint-clipped',()=>{
  assert.match(guard,/\.click-burst\{contain:layout style;overflow:visible!important\}/);
  assert.match(guard,/\.meteor-hit-explosion\{contain:layout style;overflow:visible!important\}/);
  assert.doesNotMatch(guard,/contain:layout paint style|contain:paint/);
  assert.match(meteor,/\.meteor-hit-explosion\{[\s\S]*?overflow:visible;/);
  assert.match(guard,/limitEffects\('\.click-burst', 2\)/);
  assert.match(guard,/limitEffects\('\.meteor-hit-explosion', 1\)/);
});
function burstHarness(tier){
  const explosions=[];
  function make(tag){
    return {
      tag,className:'',style:{setProperty(){},left:'',top:''},children:[],
      appendChild(node){this.children.push(node);},
      remove(){const i=explosions.indexOf(this);if(i>=0)explosions.splice(i,1);}
    };
  }
  const document={
    querySelectorAll(){throw new Error('Critical tap path may not scan the DOM');},
    createElement:make,
    body:{appendChild:el=>explosions.push(el)}
  };
  const window={starryPerformance:{getTier:()=>tier}};
  const code='function createExplosion(x, y) {'+
    meteor.split('  function createExplosion(x, y) {')[1].split('\n  function explodeMeteor(')[0];
  const context={document,window,setTimeout(){return 1},clearTimeout(){},Math};
  runInNewContext('let activeBurst = null; let burstRemovalTimer = null;'+code+';this.createExplosion=createExplosion;',context);
  return {explode:context.createExplosion,explosions};
}
test('150 rapid explosions leave exactly one active burst and no graphic accumulation',()=>{
  const fx=burstHarness('high');
  for(let i=0;i<150;i++){
    fx.explode(30+i,100);
    assert.equal(fx.explosions.length,1,'old effect must be deleted before next is added');
    assert.equal(fx.explosions[0].children.length,8);
  }
});
test('reduced mobile tiers retain blast but shed visual shards safely',()=>{
  for(const [tier,expected] of [['high',8],['medium',5],['low',3],['eco',2]]){
    const fx=burstHarness(tier);
    fx.explode(30,100);
    assert.equal(fx.explosions.length,1);
    assert.equal(fx.explosions[0].children.length,expected);
    assert.match(meteor,/playExplosionSound\(\);/);
  }
  assert.match(meteor,/window\.dispatchEvent\(new CustomEvent\('starry:meteor-blasted'/);
  assert.match(read('battery-game-v18.js'),/targetId:targetId\(rock\), sizeLevel/);
  assert.match(read('meteor-reward-bands-v41.js'),/hundredths/);
});
test('reward overlay records are released after timeout, confirmation or failure',()=>{
  assert.match(feedback,/function forget\(item\)/);
  assert.match(feedback,/const index = pending\.indexOf\(item\)/);
  assert.match(feedback,/pending\.splice\(index, 1\)/);
  const matches=[...feedback.matchAll(/forget\(item\)/g)];
  assert.ok(matches.length>=4,'cleanup helper plus timeout, success and error');
  assert.match(feedback,/clearTimeout\(item\.timeout\)/);
  assert.match(feedback,/battery-reward-instant/);
  assert.match(read('sw.js'),/starry-shell-v36/);
  assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v36/);
});
