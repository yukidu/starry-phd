import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all planet screen offsets are preserved by the edge fade, even off screen',()=>{
  const sandbox={window:{}};
  runInNewContext(source('navigation-safe-v44.js'),sandbox);
  const safe=sandbox.window.starrySafePlanetPosition;
  const view={width:390,height:844};
  const coords=[[-90,280],[25,360],[155,450],[300,520],[425,620]];
  const positions=coords.map(([x,y])=>safe({x,y,width:125,height:143},view));
  positions.forEach((p,i)=>{
    assert.equal(p.x,coords[i][0]);
    assert.equal(p.y,coords[i][1]);
    assert.ok(p.fade>=0&&p.fade<=1);
  });
  const moved=coords.map(([x,y])=>safe({x:x+62,y:y+17,width:125,height:143},view));
  positions.forEach((p,i)=>{
    assert.equal(moved[i].x-p.x,62);
    assert.equal(moved[i].y-p.y,17);
  });
});

test('camera follows finger immediately and all planets share one camera yaw/pitch',()=>{
  const app=source('app-v5.js');
  assert.match(app,/if \(dragging\) \{\s*displayedYaw = viewYaw\(\);\s*displayedPitch = viewPitch\(\);\s*return;/);
  assert.match(app,/const yaw = displayedYaw, pitch = displayedPitch/);
  assert.match(app,/const dyaw = normAngle\(p.yaw - yaw\)/);
  assert.match(app,/const dpitch = p.pitch - pitch/);
  assert.match(app,/starrySafePlanetPosition\(\{x,y,width:bounds.width\*planetDisplayScale,height:bounds.height\*planetDisplayScale\}/);
  assert.doesNotMatch(app,/starryArrangePlanetCards/);
});

test('finger can begin drag on native service-card links without losing tap',()=>{
  const app=source('app-v5.js');
  assert.match(app,/dragStartedOnServiceLink = e.pointerType === 'touch'/);
  assert.match(app,/if\(isInteractive\(e.target\) && !dragStartedOnServiceLink\)return/);
  assert.match(app,/if\(!dragStartedOnServiceLink\) \{/);
  assert.match(app,/totalMove > 14/);
  assert.match(source('interaction-v16.js'),/nativeLink\.href = url/);
  assert.match(source('interaction-v16.js'),/if \(travel > 14\) touchPress.dragged = true/);
});

test('card width tracks its title/URL, and padding is smaller on phone',()=>{
  const s=source('universe-readability-v41.js');
  assert.match(s,/width:max-content!important/);
  assert.match(s,/min-width:0!important/);
  assert.match(s,/padding:8px 10px!important/);
  assert.match(s,/padding:7px 9px!important/);
  assert.doesNotMatch(s,/min-width:min\(196px/);
  assert.match(s,/background:transparent!important/);
  assert.match(s,/--starry-earth-diameter:52px/);
  assert.match(source('app-v5.js'),/targetTiltYaw = clamp\(x \/ 24,-1,1\) \* 6/);
});
