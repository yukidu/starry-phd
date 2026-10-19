import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const source = read('battery-game-v18.js');
const start = source.indexOf('  function closeAccountMenu(');
const end = source.indexOf("  badge.addEventListener('click'", start);
assert.ok(start > 0 && end > start, 'account menu actions are present');
const actions = source.slice(start, end);

function setup({confirm = true, logoutSuccess = true, pending = false} = {}) {
  const calls = [], events = [];
  const status = {textContent: ''};
  const buttons = Array.from({length:3}, () => ({disabled:false}));
  const accountMenu = {
    hidden:false, style:{}, offsetWidth:260,
    querySelector: selector => selector === '.account-menu-status' ? status : buttons[0],
    querySelectorAll: () => buttons
  };
  const badge = {
    dataset:{accountReady:'1'},
    setAttribute(name,value){events.push([name,value]);},
    focus(){events.push(['focus']);}
  };
  let unblock;
  const gate = pending ? new Promise(resolve => {unblock=resolve}) : null;
  const ctx = {
    accountMenu,badge,accountTransitioning:false,
    rewardDrainPromise:gate,rewardQueueRunning:false,rewardQueue:[],
    activeRewardRequests: pending ? 1 : 0,
    balanceGeneration:4,balanceReadSequence:7,optimisticAwards:new Map([['A',15]]),
    window:{
      confirm:()=>confirm,innerWidth:900,
      google:{accounts:{id:{disableAutoSelect(){events.push(['google-reset']);}}}}
    },
    fetch:async (url,opts)=>{
      calls.push({url,opts});
      return {ok:logoutSuccess,json:async()=>({success:logoutSuccess})};
    },
    LOGOUT_API:'https://id.starry.phd/api/logout',
    displayLoggedOut:()=>events.push(['logged-out']),
    openLogin:()=>events.push(['choose-account']),
    Promise, Error
  };
  runInNewContext(actions + '\nthis.actions={performAccountExit,closeAccountMenu,openAccountMenu};',ctx);
  return {ctx,calls,events,status,buttons,
    exit:mode=>ctx.actions.performAccountExit(mode),
    settle:()=>{ctx.activeRewardRequests=0;unblock?.();}
  };
}

test('original battery row colors, sizing, icon and lightning remain unchanged',()=>{
  assert.match(source,/#starryBatteryCenter\{[^\n]*color:#fff4a9;text-shadow:none;user-select:none/);
  assert.match(source,/#starryBatteryCenter \.battery-value\{[^\n]*font:700 clamp\(14px,1.5vw,18px\)/);
  assert.match(source,/batteryIcon\.textContent = '🔋'/);
  assert.match(source,/window\.StarryBatteryCharge\?\.mount\(batteryIcon\)/);
  assert.match(source,/window\.StarryBatteryCharge\?\.flash\(chargeBolt\)/);
  assert.match(source,/document\.body\.appendChild\(accountMenu\)/);
  assert.match(source,/#starryBatteryCenter\[data-account-ready="1"\]\{cursor:pointer;pointer-events:auto!important\}/);
  assert.match(source,/accountMenu\.setAttribute\('role', 'menu'\)/);
  for(const action of ['logout','switch','cancel']) {
    assert.ok(source.includes('data-account-action="'+action+'"'));
  }
  assert.match(source,/badge\.addEventListener\('keydown'/);
  assert.match(source,/accountMenu\.addEventListener\('click'/);
});

test('logout requires confirmation, cancellation never touches central session',async()=>{
  const h=setup({confirm:false});
  await h.exit(false);
  assert.equal(h.calls.length,0);
  assert.equal(h.events.length,0);
});

test('switch waits for all old-account credits before central logout and account choice',async()=>{
  const h=setup({pending:true});
  const task=h.exit(true);
  await Promise.resolve();
  assert.equal(h.calls.length,0);
  assert.equal(h.ctx.accountTransitioning,true);
  assert.equal(h.status.textContent,'正在確認舊帳號的電池獎勵…');
  assert.equal(h.buttons.every(b=>b.disabled),true);
  h.settle();await task;
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].url,'https://id.starry.phd/api/logout');
  assert.equal(h.calls[0].opts.method,'POST');
  assert.equal(h.calls[0].opts.credentials,'include');
  assert.deepEqual(Array.from(h.events.filter(e=>e[0]==='logged-out'||e[0]==='choose-account'),e=>e[0]),['logged-out','choose-account']);
  assert.equal(h.ctx.balanceGeneration,5);
  assert.equal(h.ctx.balanceReadSequence,8);
  assert.equal(h.ctx.optimisticAwards.size,0);
  assert.equal(h.ctx.accountTransitioning,false);
  assert.equal(h.buttons.every(b=>!b.disabled),true);
});

test('failed central logout keeps prior account, balance and pending awards',async()=>{
  const h=setup({logoutSuccess:false});
  await h.exit(true);
  assert.equal(h.calls.length,1);
  assert.equal(h.events.some(e=>e[0]==='logged-out'),false);
  assert.equal(h.events.some(e=>e[0]==='choose-account'),false);
  assert.equal(h.ctx.optimisticAwards.size,1);
  assert.equal(h.ctx.balanceGeneration,4);
  assert.match(h.status.textContent,/無法確認登出成功/);
  assert.equal(h.buttons.every(b=>!b.disabled),true);
});

test('active new meteor shots and stale reads are guarded during a switch',()=>{
  assert.match(source,/if \(accountTransitioning \|\| !\(rock instanceof HTMLElement\)/);
  assert.match(source,/if \(accountTransitioning\) return;\s*const generation = balanceGeneration/);
  assert.match(source,/rewardDrainPromise = drainRewardQueue\(\)/);
  assert.match(source,/if \(rewardDrainPromise\) await rewardDrainPromise/);
  assert.match(source,/rewardQueueRunning \|\| rewardQueue.length \|\| activeRewardRequests !== 0/);
  assert.match(source,/balanceGeneration\+\+;\s*balanceReadSequence\+\+;/);
  assert.match(source,/data\.success !== true/);
  assert.match(source,/window\.google\?\.accounts\?\.id\?\.disableAutoSelect\?\.\(\)/);
});

test('PWA and both workflows package account menu and correct new cache',()=>{
  assert.match(read('sw.js'),/starry-shell-v42/);
  for (const path of ['.github/workflows/pr-check.yml','.github/workflows/deploy.yml']) {
    const text=read(path);
    assert.match(text,/starry-battery-account-menu/);
    assert.match(text,/api\/logout/);
    if (path.endsWith('deploy.yml')) assert.match(text,/starry-shell-v42/);
    assert.match(text,/battery-game-v18\.js/);
  }
});
