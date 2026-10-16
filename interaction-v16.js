(() => {
  // v37-native-service-links
  // 只有星球下方服務卡片可開啟 App；改用真正 <a> 連結，避免桌機瀏覽器攔截 window.open。
  let touchPress = null;

  function getCardTarget(target) {
    if (!(target instanceof Element)) return null;
    const label = target.closest('.service-label');
    const card = target.closest('.planet-wrap[data-url]');
    if (!label || !card || label.closest('.planet-wrap[data-url]') !== card) return null;
    return { label, card };
  }

  document.querySelectorAll('.planet-wrap[data-url]').forEach((card) => {
    const label = card.querySelector('.service-label');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
    card.style.cursor = 'default';

    if (!label) return;
    const name = card.querySelector('.service-name')?.textContent?.trim() || 'Starry App';
    const host = card.querySelector('.service-host')?.textContent?.trim() || '';
    const url = card.dataset.url;

    label.removeAttribute('role');
    label.removeAttribute('tabindex');
    label.removeAttribute('aria-label');
    label.style.cursor = 'pointer';

    let nativeLink = label.querySelector(':scope > .starry-service-native-link');
    if (!nativeLink && url) {
      nativeLink = document.createElement('a');
      nativeLink.className = 'starry-service-native-link';
      nativeLink.href = url;
      nativeLink.target = '_blank';
      nativeLink.rel = 'noopener noreferrer';
      nativeLink.setAttribute('aria-label', host ? `${name}，在新視窗開啟 ${host}` : name);
      label.appendChild(nativeLink);
    }

    nativeLink?.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  // 手機拖曳 360° 視野時不要誤開服務卡；桌機滑鼠不套用此門檻。
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const target = getCardTarget(event.target);
    if (!target) {
      touchPress = null;
      return;
    }
    touchPress = {
      label: target.label,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragged: false
    };
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!touchPress || event.pointerId !== touchPress.pointerId) return;
    const travel = Math.abs(event.clientX - touchPress.x) + Math.abs(event.clientY - touchPress.y);
    if (travel > 14) touchPress.dragged = true;
  }, true);

  document.addEventListener('pointerup', (event) => {
    if (!touchPress || event.pointerId !== touchPress.pointerId) return;
    if (touchPress.dragged) touchPress.label.dataset.v37DraggedAt = String(performance.now());
    touchPress = null;
  }, true);

  document.addEventListener('pointercancel', () => {
    touchPress = null;
  }, true);

  // 星球本體、星球名稱與卡片外區域一律不導頁；服務卡上的原生連結交給瀏覽器直接處理。
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest('.planet-wrap[data-url]');
    if (!card) return;

    const label = event.target.closest('.service-label');
    const isServiceCard = !!label && label.closest('.planet-wrap[data-url]') === card;

    if (!isServiceCard) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const draggedAt = Number(label.dataset.v37DraggedAt || 0);
    if (performance.now() - draggedAt < 650) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // 點在真正的 <a> 上時不 preventDefault，讓桌機 Chrome / Safari 使用原生導頁。
    if (event.target.closest('.starry-service-native-link')) return;

    // 保險：若極少數瀏覽器沒有命中覆蓋連結，仍不要觸發舊的整顆星球導頁。
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // Tablet / large-screen readability: make service-card text substantially larger.
  const style = document.createElement('style');
  style.textContent = `
    .planet-wrap[data-url] { cursor: default !important; }
    .planet-wrap[data-url] em.service-label { cursor: pointer !important; }
    .starry-service-native-link{position:absolute;inset:0;z-index:20;display:block;border-radius:inherit;background:transparent;text-decoration:none;color:inherit;cursor:pointer;touch-action:none}
    .starry-service-native-link:focus-visible{outline:2px solid #7df9ff;outline-offset:3px}

    #starryBatteryCenter .battery-value.account-ready{pointer-events:auto!important;cursor:pointer!important}
    #starryBatteryCenter .battery-value.account-ready:focus-visible{outline:2px solid #7df9ff;outline-offset:5px}
    .starry-account-backdrop{position:fixed;inset:0;z-index:170;display:flex;align-items:flex-end;justify-content:center;padding:max(14px,env(safe-area-inset-bottom)) 12px;background:rgba(0,3,13,.56);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease}
    .starry-account-backdrop.open{opacity:1;visibility:visible}
    .starry-account-sheet{position:relative;width:min(430px,100%);padding:22px 16px 16px;border:1px solid rgba(105,232,255,.38);border-radius:22px;background:linear-gradient(160deg,rgba(5,17,39,.99),rgba(5,8,24,.99) 58%,rgba(25,8,46,.98));box-shadow:0 -18px 70px rgba(0,0,0,.52),0 0 42px rgba(66,187,255,.16);color:#effcff;text-align:center}
    .starry-account-sheet::before{content:"";position:absolute;left:14%;right:14%;top:0;height:1px;background:linear-gradient(90deg,transparent,#7df9ff,transparent);box-shadow:0 0 16px #7df9ff}
    .starry-account-title{margin:0 0 6px;font:800 19px/1.25 "Orbitron","Noto Sans TC",system-ui,sans-serif;letter-spacing:.05em}
    .starry-account-copy{margin:0 0 15px;color:#a9cde1;font:600 12px/1.55 "Noto Sans TC",system-ui,sans-serif}
    .starry-account-actions{display:grid;gap:10px}
    .starry-account-action{min-height:48px;border:1px solid rgba(125,249,255,.28);border-radius:13px;background:rgba(8,24,49,.78);color:#effcff;font:800 14px/1 "Noto Sans TC",system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
    .starry-account-action.primary{border-color:rgba(125,249,255,.55);box-shadow:0 0 18px rgba(64,194,255,.12)}
    .starry-account-action.logout{border-color:rgba(255,154,170,.28);color:#ffdce2;background:rgba(44,12,28,.62)}
    .starry-account-action:disabled{opacity:.5;cursor:wait}
    .starry-account-status{min-height:18px;margin-top:10px;color:#bfeaff;font:700 11px/1.45 "Noto Sans TC",system-ui,sans-serif}
    .starry-account-status.error{color:#ffb8c2}
    .starry-account-close{position:absolute;right:9px;top:9px;width:34px;height:34px;border:1px solid rgba(164,224,255,.25);border-radius:50%;background:rgba(5,14,33,.74);color:#eafaff;font-size:19px;cursor:pointer}

    @media (min-width: 768px) {
      .planet-wrap em.service-label {
        min-width: 210px !important;
        padding: 12px 16px 14px !important;
        border-radius: 14px !important;
      }
      .planet-wrap .service-name {
        font-size: 22px !important;
        line-height: 1.22 !important;
      }
      .planet-wrap .service-host {
        margin-top: 7px !important;
        font-size: 14px !important;
        line-height: 1.1 !important;
        letter-spacing: .06em !important;
      }
      .planet-wrap .celestial-name {
        font-size: 11px !important;
      }
      .p5 em.service-label { margin-top: 36px !important; }
      .p6 em.service-label { margin-top: 31px !important; }
    }

    @media (min-width: 1200px) {
      .planet-wrap em.service-label {
        min-width: 245px !important;
        padding: 15px 20px 17px !important;
        border-radius: 16px !important;
      }
      .planet-wrap .service-name {
        font-size: 29px !important;
        line-height: 1.18 !important;
      }
      .planet-wrap .service-host {
        margin-top: 8px !important;
        font-size: 17px !important;
      }
      .planet-wrap .celestial-name {
        font-size: 13px !important;
      }
      .p5 em.service-label { margin-top: 42px !important; }
      .p6 em.service-label { margin-top: 36px !important; }
    }
  `;
  document.head.appendChild(style);

  // v35-account-menu-direct：登入後直接讓「電池數量按鈕」可點，不再用透明覆蓋層攔截。
  const STARRY_LOGOUT_URL = 'https://id.starry.phd/api/logout';
  const SWITCH_ACCOUNT_KEY = 'starry:switch-account-after-logout';

  function initBatteryAccountActions() {
    const badge = document.getElementById('starryBatteryCenter');
    const value = badge?.querySelector('.battery-value');
    if (!(badge instanceof HTMLElement) || !(value instanceof HTMLButtonElement)) return;
    if (badge.dataset.accountActionsReady === '1') return;
    badge.dataset.accountActionsReady = '1';

    const overlay = document.createElement('div');
    overlay.className = 'starry-account-backdrop';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="starry-account-sheet" role="dialog" aria-modal="true" aria-label="帳號選項"><button class="starry-account-close" type="button" aria-label="關閉">×</button><h2 class="starry-account-title">STARRY ID</h2><p class="starry-account-copy">選擇要切換 Google 登入帳號，或登出目前帳號。</p><div class="starry-account-actions"><button class="starry-account-action primary" type="button" data-account-action="switch">切換登入帳號</button><button class="starry-account-action logout" type="button" data-account-action="logout">登出</button></div><div class="starry-account-status" role="status"></div></section>`;
    document.body.appendChild(overlay);

    const closeButton = overlay.querySelector('.starry-account-close');
    const switchButton = overlay.querySelector('[data-account-action="switch"]');
    const logoutButton = overlay.querySelector('[data-account-action="logout"]');
    const status = overlay.querySelector('.starry-account-status');
    const actionButtons = [switchButton, logoutButton].filter((button) => button instanceof HTMLButtonElement);

    const isLoggedIn = () => {
      const text = String(value.textContent || '').trim();
      return !value.classList.contains('login-ready') && text !== '--' && text !== '請先登入';
    };

    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      if (status) {
        status.textContent = '';
        status.classList.remove('error');
      }
    };

    const open = () => {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      if (switchButton instanceof HTMLButtonElement) switchButton.focus({ preventScroll: true });
    };

    const syncAccountState = () => {
      if (isLoggedIn()) {
        if (value.disabled) value.disabled = false;
        if (!value.classList.contains('account-ready')) value.classList.add('account-ready');
        if (value.title !== '帳號選項') value.title = '帳號選項';
      } else {
        if (value.classList.contains('account-ready')) value.classList.remove('account-ready');
        if (value.hasAttribute('title')) value.removeAttribute('title');
      }
    };

    const valueObserver = new MutationObserver(syncAccountState);
    valueObserver.observe(value, { attributes: true, childList: true, characterData: true, subtree: true });
    requestAnimationFrame(syncAccountState);

    // capture=true：登入狀態先攔截，避免和原本「未登入 → 開登入視窗」的 click 邏輯互相干擾。
    value.addEventListener('click', (event) => {
      if (!isLoggedIn()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);

    closeButton?.addEventListener('click', close);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
    addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) close(); });

    async function endSession(andSwitchAccount) {
      actionButtons.forEach((button) => { button.disabled = true; });
      if (status) {
        status.textContent = andSwitchAccount ? '正在切換帳號…' : '正在登出…';
        status.classList.remove('error');
      }
      if (andSwitchAccount) sessionStorage.setItem(SWITCH_ACCOUNT_KEY, '1');
      else sessionStorage.removeItem(SWITCH_ACCOUNT_KEY);

      try {
        await fetch(STARRY_LOGOUT_URL, {
          method: 'POST',
          mode: 'no-cors',
          credentials: 'include',
          cache: 'no-store',
          keepalive: true
        });
        try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch (_) {}
        location.reload();
      } catch (error) {
        if (andSwitchAccount) sessionStorage.removeItem(SWITCH_ACCOUNT_KEY);
        actionButtons.forEach((button) => { button.disabled = false; });
        if (status) {
          status.textContent = '目前無法完成，請再試一次。';
          status.classList.add('error');
        }
        console.warn('Starry account action:', error);
      }
    }

    switchButton?.addEventListener('click', () => { void endSession(true); });
    logoutButton?.addEventListener('click', () => { void endSession(false); });

    if (sessionStorage.getItem(SWITCH_ACCOUNT_KEY) === '1') {
      sessionStorage.removeItem(SWITCH_ACCOUNT_KEY);
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (value.classList.contains('login-ready')) {
          clearInterval(timer);
          value.click();
          return;
        }
        if (Date.now() - startedAt > 8000) clearInterval(timer);
      }, 180);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBatteryAccountActions, { once: true });
  } else {
    queueMicrotask(initBatteryAccountActions);
  }
})();
