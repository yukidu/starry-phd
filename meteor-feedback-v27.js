(() => {
  // v28：隕石維持三角形／四邊形；爆破時在實際點擊位置立即靜態顯示獎勵；移除底部 360° 狀態框。
  const style = document.createElement('style');
  style.textContent = `
    .status-pill{display:none!important}
    .battery-reward-float{display:none!important}
    .battery-reward-instant{
      position:fixed;z-index:146;pointer-events:none;transform:translate(-50%,-50%);
      padding:7px 10px;border:1px solid rgba(255,224,126,.34);border-radius:9px;
      background:rgba(24,15,5,.74);color:#fff4a9;
      font:900 17px/1.15 "Noto Sans TC",Arial,system-ui,-apple-system,"Segoe UI",sans-serif;
      font-variant-numeric:tabular-nums;font-feature-settings:"zero" 0;
      white-space:nowrap;text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);
      box-shadow:0 0 18px rgba(255,190,68,.22);
    }
  `;
  document.head.appendChild(style);

  document.querySelector('.status-pill')?.remove();

  const shapes = [
    'polygon(50% 0,100% 88%,6% 100%)',
    'polygon(10% 10%,100% 36%,35% 100%)',
    'polygon(20% 0,100% 78%,0 100%)',
    'polygon(18% 0,100% 22%,84% 100%,0 72%)',
    'polygon(0 20%,78% 0,100% 82%,28% 100%)',
    'polygon(12% 0,100% 14%,72% 100%,0 84%)'
  ];

  function makeTriOrQuad(rock) {
    if (!(rock instanceof HTMLElement) || !rock.matches('.space-rock.small')) return;
    rock.style.setProperty('--rock-poly', shapes[Math.floor(Math.random() * shapes.length)]);
    rock.style.setProperty('--rock-spin', `${Math.floor(Math.random() * 360)}deg`);
    rock.dataset.v27Shape = '1';
  }

  document.querySelectorAll('.space-rock.small').forEach(makeTriOrQuad);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('.space-rock.small')) makeTriOrQuad(node);
        node.querySelectorAll?.('.space-rock.small').forEach(makeTriOrQuad);
      }
    }
  }).observe(document.body, { childList:true, subtree:true });

  const pending = [];
  function forget(item) {
    const index = pending.indexOf(item);
    if (index !== -1) pending.splice(index, 1);
  }
  let lastMeteorPointer = null;

  document.addEventListener('pointerdown', (event) => {
    const rock = event.target instanceof Element ? event.target.closest('.space-rock.small') : null;
    if (!(rock instanceof HTMLElement)) return;
    lastMeteorPointer = { rock, x:event.clientX, y:event.clientY, at:performance.now() };
  }, true);

  function tierPreview(rock) {
    const cents=Number(rock?.dataset?.batteryRewardHundredths);
    return Number.isInteger(cents) && cents>=1 && cents<=100 ? (cents/100).toFixed(2) : '0.01';
  }

  function showImmediateReward(x, y, rock) {
    const el = document.createElement('span');
    el.className = 'battery-reward-instant';
    el.style.left = `${Math.min(Math.max(Number(x || 0), 66), Math.max(66, innerWidth - 66))}px`;
    el.style.top = `${Math.min(Math.max(Number(y || 0), 36), Math.max(36, innerHeight - 36))}px`;
    el.textContent = `獎勵 +${tierPreview(rock)} 顆電池`;
    document.body.appendChild(el);

    const item = { el, rock, done:false, timeout:0 };
    item.timeout = setTimeout(() => {
      if (item.done) return;
      item.done = true;
      el.remove();
      forget(item);
    }, 2200);
    pending.push(item);
  }

  function settleReward(amount, targetId) {
    const item = pending.find((entry) => !entry.done && entry.el.isConnected && entry.rock?.dataset?.batteryTargetId === targetId);
    if (!item) return;
    item.done = true;
    clearTimeout(item.timeout);
    forget(item);
    item.el.textContent = `獎勵 +${Number(amount).toFixed(2)} 顆電池`;
    setTimeout(() => item.el.remove(), 1100);
  }

  addEventListener('starry:meteor-blasted', (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!(detail?.rock instanceof HTMLElement)) return;
    const loginButton = document.querySelector('#starryBatteryCenter .battery-value');
    if (loginButton?.classList.contains('login-ready')) return;

    const pointer = lastMeteorPointer && lastMeteorPointer.rock === detail.rock && performance.now() - lastMeteorPointer.at < 500
      ? lastMeteorPointer
      : null;
    showImmediateReward(pointer?.x ?? detail.x, pointer?.y ?? detail.y, detail.rock);
    lastMeteorPointer = null;
  }, true);

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement) || !node.matches('.battery-reward-float')) continue;
        const match = node.textContent?.match(/\+([0-9]+(?:\.[0-9]+)?)/);
        if (match) settleReward(Number(match[1]), node.dataset.batteryTargetId || '');
      }
    }
  }).observe(document.body, { childList:true });
  addEventListener('starry:meteor-reward-failed',(event)=>{
    const rock = event instanceof CustomEvent ? event.detail?.rock : null;
    const item = pending.find(entry=>!entry.done && entry.rock===rock);
    if(!item)return;
    item.done=true;clearTimeout(item.timeout);item.el.remove();forget(item);
  });
})();
