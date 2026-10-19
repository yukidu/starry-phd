import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),interaction=read('interaction-v16.js'),app=read('app-v5.js');

test('V65 prevents Chrome and Safari selecting ONLY the universe text',()=>{
  assert.match(html,/\.universe,\.universe \.planet-lane,\.universe \.planet-wrap,\.universe \.planet-wrap \*\{-webkit-user-select:none!important;user-select:none!important\}/);
  assert.match(html,/\.universe \.planet-wrap a\{-webkit-user-drag:none!important\}/);
  assert.doesNotMatch(html,/html,body\{[^}]*user-select:none/);
  assert.doesNotMatch(html,/\.portal-modal\{[^}]*user-select:none/);
  assert.match(html,/<div class="planet-lane" id="planetLane">/);
  assert.match(html,/class="service-name"/);
  assert.match(html,/class="service-host"/);
  assert.match(html,/class="celestial-name"/);
  assert.match(html,/<main class="hero">/);
});
test('native Starry App links remain real, focusable, and usable for normal clicks',()=>{
 assert.match(interaction,/nativeLink\.href = url/);
 assert.match(interaction,/nativeLink\.target = '_blank'/);
 assert.match(interaction,/nativeLink\.rel = 'noopener noreferrer'/);
 assert.match(interaction,/nativeLink\.draggable = false/);
 assert.match(interaction,/nativeLink\.setAttribute\('aria-label'/);
 assert.match(interaction,/if \(event\.target\.closest\('\.starry-service-native-link'\)\) return;/);
 assert.match(interaction,/\.starry-service-native-link:focus-visible\{outline:2px/);
 assert.doesNotMatch(interaction,/nativeLink\?\.addEventListener\('pointerdown'.*preventDefault/);
});
function mouseHarness(){
 class Element{
   constructor(kind){this.kind=kind;this.dataset={}}
   closest(selector){
     if(selector==='.planet-wrap[data-url]')return card;
     if(selector==='.service-label')return label;
     if(selector==='.starry-service-native-link')return this===link?link:null;
     return null;
   }
 }
 const card=new Element('planet'),label=new Element('label'),link=new Element('link'),outside={};
 let now=2;
 const listeners=new Map();
 const document={addEventListener:(type,cb)=>listeners.set(type,cb)};
 const getCard=interaction.slice(interaction.indexOf('  function getCardTarget(target) {'),interaction.indexOf('\n  document.querySelectorAll('));
 const start=interaction.indexOf('  // V65: both touch and desktop mouse');
 const end=interaction.indexOf('  // Tablet / large-screen readability:',start);
 assert.ok(start>0&&end>start);
 const code='let touchPress=null;'+getCard+'\n'+interaction.slice(start,end);
 runInNewContext(code,{document,Element,performance:{now:()=>now},Number,String});
 const send=(type,{pointerType='mouse',pointerId=11,x=100,y=100,target=link}={})=>{
    let prevented=false,stopped=false;
    const ev={pointerType,pointerId,clientX:x,clientY:y,target,
      preventDefault(){prevented=true},
      stopImmediatePropagation(){stopped=true}};
    const callback=listeners.get(type);assert.ok(callback,'missing '+type);
    callback(ev);
    return {get prevented(){return prevented},get stopped(){return stopped}};
 };
 return {send,label,link,card,outside,setTime:n=>{now=n}};
}
test('mouse dragging a service link changes to drag, not text selection or navigation',()=>{
 const h=mouseHarness();
 h.setTime(1000);
 h.send('pointerdown',{x:120,y:180});
 h.send('pointermove',{x:132,y:180});
 h.send('pointerup',{x:132,y:180});
 assert.equal(h.label.dataset.v37DraggedAt,'1000');
 const click=h.send('click',{x:132,y:180});
 assert.equal(click.prevented,true);
 assert.equal(click.stopped,true);
 assert.match(app,/if \(e\.pointerType === 'mouse' && e\.target instanceof Element/);
 assert.match(app,/e\.target\.closest\('\.starry-service-native-link'\)\) dragStartedOnServiceLink = true/);
 assert.match(app,/e\.preventDefault\(\);\s*const dx=e\.clientX-lastX/);
 assert.match(app,/if \(dragStartedOnServiceLink && !dragCaptured && totalMove > 14\)/);
});
test('simple desktop clicks and keyboard activation still follow native service links',()=>{
 const h=mouseHarness();
 h.setTime(10);
 const keyboard=h.send('click',{});
 assert.equal(keyboard.prevented,false);
 h.setTime(2000);
 h.send('pointerdown',{x:100,y:200});
 h.send('pointerup',{x:100,y:200});
 const click=h.send('click',{x:100,y:200});
 assert.equal(click.prevented,false);
 assert.equal(click.stopped,false);
});
test('touch-only swipe guard still blocks navigation, while other page text is untouched',()=>{
 const h=mouseHarness();
 h.setTime(3000);
 h.send('pointerdown',{pointerType:'touch',x:90,y:130});
 h.send('pointermove',{pointerType:'touch',x:110,y:145});
 h.send('pointerup',{pointerType:'touch',x:110,y:145});
 assert.equal(h.send('click',{}).prevented,true);
 const outside=h.send('click',{target:h.outside});
 assert.equal(outside.prevented,false);
 assert.match(app,/dragStartedOnServiceLink = e\.pointerType === 'touch'/);
 assert.match(app,/if\(isInteractive\(e\.target\) && !dragStartedOnServiceLink\)return/);
 assert.match(read('sw.js'),/starry-shell-v42/);
});
test('planet, solar, galaxy, battery, and nine-app layout remain on the same version',()=>{
 assert.match(app,/window\.starryAdaptivePlanetScale/);
 assert.match(app,/let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;/);
 assert.match(read('visual-v15.js'),/html\[data-starry-quality="eco"\] \.milky-way\{filter:none!important;animation:none!important/);
 assert.match(read('battery-game-v18.js'),/window\.StarryBatteryCharge\?\.flash\(chargeBolt\)/);
 assert.match(read('meteor-v14.js'),/starry:meteor-blasted/);
 assert.match(html,/\.universe > #meteorLayer\{position:absolute;inset:0;z-index:1/);
 assert.match(read('.github/workflows/deploy.yml'),/starry-shell-v42/);
});
