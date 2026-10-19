(() => {
  // Web First：主站直接使用 Google Identity Services，會員與電池仍由中央 Starry ID 管理。
  const API = 'https://id.starry.phd/api/starry-game/battery';
  const LOGIN_API = 'https://id.starry.phd/api/google-sync';
  const LOGOUT_API = 'https://id.starry.phd/api/logout';
  const LOGIN_FALLBACK_URL = 'https://id.starry.phd/starry-main-login';
  const LOGIN_ORIGIN = 'https://id.starry.phd';
  const GOOGLE_CLIENT_ID = '661055525630-ndcq5gtr16h7rqqprlqqkkvineea87lc.apps.googleusercontent.com';
  let currentBalance = null; // Server-confirmed balance only.
  // V62: show unconfirmed rewards immediately, but never persist estimates.
  // Serialize existing POSTs so a confirmed server balance cannot already
  // include another request that is still awaiting its response.
  const optimisticAwards = new Map();
  const rewardQueue = [];
  let rewardQueueRunning = false;
  let rewardDrainPromise = null;
  let accountTransitioning = false;
  let balanceGeneration = 0, balanceReadSequence = 0, activeRewardRequests = 0;
  let loginSheet = null;
  let googleInitialized = false;
  let googleSdkPromise = null;

  document.getElementById('freeLookHint')?.remove();

  const style = document.createElement('style');
  style.textContent = `
    .free-look-hint{display:none!important}
    #immersiveToggle{display:none!important}
    #starryBatteryCenter{position:relative;z-index:25;display:inline-flex;align-items:center;justify-content:center;gap:4px 10px;margin:10px auto 0;padding:0;border:0;background:transparent;text-align:center;color:#fff4a9;text-shadow:none;user-select:none}
    #starryBatteryCenter .battery-title{display:inline;margin:0;color:#fff4a9;font:700 clamp(14px,1.5vw,18px)/1.15 "Noto Sans TC",system-ui,sans-serif;letter-spacing:.06em;pointer-events:none}
    #starryBatteryCenter .battery-value{position:relative;display:inline;margin:0;padding:0;border:0;background:none;color:#fff4a9;font:700 clamp(14px,1.5vw,18px)/1.15 "Noto Sans TC",system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.06em;text-shadow:none;overflow:visible}
    #starryBatteryCenter .battery-value:disabled{opacity:1;color:#fff4a9}
    /* Signed-in balance: absolutely no background panel. Guest login stays unchanged. */
    #starryBatteryCenter{background:none!important;border:0!important;box-shadow:none!important}
    /* V63: actual stock is plain text, NEVER browser-native disabled-button chrome. */
    #starryBatteryCenter .battery-value:not(.login-ready){-webkit-appearance:none!important;appearance:none!important;display:inline!important;background:transparent!important;background-image:none!important;background-color:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;outline:none!important;clip-path:none!important;padding:0!important;min-height:0!important;filter:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;pointer-events:none!important}
    #starryBatteryCenter .battery-value:not(.login-ready)::before,
    #starryBatteryCenter .battery-value:not(.login-ready)::after{content:none!important;display:none!important}
    #starryBatteryCenter .battery-icon{position:relative;display:inline-grid;place-items:center;width:26px;height:30px;line-height:1;font-size:23px;flex:none;isolation:isolate}
    #starryBatteryCenter .battery-title{display:inline-flex;align-items:center;gap:2px;overflow:visible}
    #starryBatteryCenter .battery-value.login-ready{pointer-events:auto;cursor:pointer;min-height:38px;padding:8px 18px 8px 20px;border:1px solid rgba(103,238,255,.72);border-radius:9px;background:linear-gradient(135deg,rgba(7,28,55,.96),rgba(8,11,34,.94) 52%,rgba(37,14,67,.92));color:#eaffff;font:800 14px/1 "Orbitron","Noto Sans TC",system-ui,sans-serif;letter-spacing:.14em;text-decoration:none;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);box-shadow:0 0 0 1px rgba(112,239,255,.08) inset,0 0 15px rgba(54,219,255,.22),0 0 32px rgba(108,69,255,.16);text-shadow:0 0 10px rgba(112,239,255,.7);animation:starryLoginPulse 2.2s ease-in-out infinite}
    #starryBatteryCenter .battery-value.login-ready::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 0 38%,rgba(130,249,255,.23) 48%,transparent 58%);transform:translateX(-130%);animation:starryLoginScan 2.4s ease-in-out infinite;pointer-events:none}
    #starryBatteryCenter .battery-value.login-ready::after{content:"◈";margin-left:8px;color:#7df9ff;text-shadow:0 0 9px #7df9ff}
    #starryBatteryCenter .battery-value.login-ready:focus-visible{outline:2px solid #7df9ff;outline-offset:5px}
    #starryBatteryCenter.rewarded{animation:batteryRewardGlow .58s ease-out}
    .battery-reward-float{position:fixed;z-index:145;transform:translate(-50%,-50%);pointer-events:none;color:#fff4a9;font:900 18px/1 "Orbitron","Noto Sans TC",system-ui,sans-serif;text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);animation:batteryRewardFloat .9s cubic-bezier(.16,.9,.25,1) forwards}
    @keyframes starryLoginPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18);box-shadow:0 0 0 1px rgba(112,239,255,.12) inset,0 0 20px rgba(54,219,255,.34),0 0 42px rgba(108,69,255,.22)}}
    @keyframes starryLoginScan{0%,22%{transform:translateX(-130%)}72%,100%{transform:translateX(150%)}}
    @keyframes batteryRewardGlow{0%,100%{filter:none}35%{filter:drop-shadow(0 0 12px rgba(255,220,86,.9))}}
    @keyframes batteryRewardFloat{0%{opacity:1;transform:translate(-50%,-50%) scale(.92)}22%{opacity:1;transform:translate(-50%,-76%) scale(1.12)}100%{opacity:0;transform:translate(-50%,-170%) scale(.96)}}

    .space-rock.small{border-radius:0!important;background:transparent!important;box-shadow:none!important}
    .space-rock.small::before{content:"";position:absolute;inset:0;display:block;clip-path:var(--rock-poly,polygon(50% 0,86% 14%,100% 48%,82% 88%,43% 100%,9% 78%,0 37%,19% 9%));background:radial-gradient(circle at 34% 27%,#e2ddd2 0 8%,#8c8178 20%,#5c5655 47%,#322f34 72%,#15151a 100%);filter:drop-shadow(0 0 5px rgba(255,194,126,.55));transform:rotate(var(--rock-spin,0deg));transform-origin:center}

    .starry-login-backdrop{position:fixed;inset:0;z-index:130;background:rgba(0,3,13,.54);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease}
    .starry-login-backdrop.open{opacity:1;visibility:visible}
    .starry-login-sheet{position:absolute;left:50%;bottom:max(10px,env(safe-area-inset-bottom));width:min(520px,calc(100vw - 18px));transform:translate(-50%,115%);transition:transform .28s cubic-bezier(.2,.85,.2,1);border:1px solid rgba(105,232,255,.38);border-radius:24px 24px 18px 18px;padding:24px 18px 20px;background:linear-gradient(160deg,rgba(5,17,39,.98),rgba(5,8,24,.985) 58%,rgba(25,8,46,.98));box-shadow:0 -18px 70px rgba(0,0,0,.52),0 0 42px rgba(66,187,255,.16);overflow:hidden;text-align:center;color:#effcff}
    .starry-login-backdrop.open .starry-login-sheet{transform:translate(-50%,0)}
    .starry-login-sheet::before{content:"";position:absolute;left:12%;right:12%;top:0;height:1px;background:linear-gradient(90deg,transparent,#7df9ff,transparent);box-shadow:0 0 16px #7df9ff}
    .starry-login-grabber{width:52px;height:4px;margin:-10px auto 14px;border-radius:99px;background:rgba(180,232,255,.32)}
    .starry-login-title{margin:0;color:#f4fdff;font:800 21px/1.2 "Orbitron","Noto Sans TC",sans-serif;letter-spacing:.06em;text-shadow:0 0 14px rgba(125,249,255,.34)}
    .starry-login-copy{margin:9px 0 16px;color:#aacce0;font:600 13px/1.6 "Noto Sans TC",sans-serif}
    .starry-google-host{min-height:44px;display:flex;justify-content:center;align-items:center}
    .starry-login-status{min-height:22px;margin-top:12px;color:#bfeaff;font:700 12px/1.55 "Noto Sans TC",sans-serif}
    .starry-login-status.error{color:#ffb8c2}
    .starry-login-fallback{margin-top:12px;padding:7px 11px;border:0;background:transparent;color:rgba(184,222,244,.76);font:700 12px/1.4 "Noto Sans TC",sans-serif;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
    .starry-login-close{position:absolute;right:10px;top:10px;width:34px;height:34px;border:1px solid rgba(164,224,255,.25);border-radius:50%;background:rgba(5,14,33,.74);color:#eafaff;font-size:19px;cursor:pointer}
    #starryBatteryCenter[data-account-ready="1"]{cursor:pointer}
    #starryBatteryCenter[data-account-ready="1"]:focus-visible{outline:2px solid rgba(255,244,169,.9);outline-offset:4px;border-radius:4px}
    .starry-battery-account-menu{position:fixed;z-index:180;width:min(260px,calc(100vw - 24px));box-sizing:border-box;padding:6px;border:1px solid rgba(255,225,135,.45);border-radius:12px;background:rgba(13,18,36,.98);box-shadow:0 12px 32px rgba(0,0,0,.55);color:#effcff;text-align:left;font:600 14px/1.4 "Noto Sans TC",system-ui,sans-serif;user-select:text;-webkit-user-select:text}
    .starry-battery-account-menu[hidden]{display:none!important}
    .starry-battery-account-menu button{display:block;width:100%;padding:12px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
    .starry-battery-account-menu button:hover,.starry-battery-account-menu button:focus-visible{background:rgba(255,226,136,.14);outline:none}
    .starry-battery-account-menu button:disabled{opacity:.55;cursor:wait}
    .starry-battery-account-menu .account-menu-status{padding:4px 10px 8px;color:#ffcaad;font-size:12px;line-height:1.5}
    .starry-battery-account-menu .account-menu-status:empty{display:none}
    .starry-battery-account-menu button[data-account-action="cancel"]{color:#b9c5db}
    @media(max-width:760px){#starryBatteryCenter{margin-top:8px;gap:3px 8px}#starryBatteryCenter .battery-value{font-size:14px}#starryBatteryCenter .battery-title{font-size:14px}#starryBatteryCenter .battery-value.login-ready{min-height:36px;padding:8px 14px 8px 16px;font-size:12px}.starry-login-sheet{padding:22px 14px 18px}.starry-login-title{font-size:18px}}
  `;
  document.head.appendChild(style);

  const shapes = [
    'polygon(49% 0,83% 11%,100% 43%,88% 80%,60% 100%,22% 91%,0 63%,8% 25%)',
    'polygon(38% 0,77% 7%,100% 31%,92% 67%,69% 100%,31% 94%,4% 73%,0 34%,18% 10%)',
    'polygon(54% 0,91% 18%,100% 58%,76% 93%,35% 100%,7% 74%,0 38%,24% 8%)',
    'polygon(29% 2%,70% 0,97% 24%,100% 66%,73% 96%,34% 100%,3% 77%,0 39%)',
    'polygon(46% 0,80% 9%,99% 37%,89% 75%,64% 100%,26% 94%,0 67%,7% 26%)'
  ];
  function shapeRock(rock) {
    if (!(rock instanceof HTMLElement) || !rock.matches('.space-rock.small') || rock.dataset.irregularRock === '1') return;
    rock.dataset.irregularRock = '1';
    rock.style.setProperty('--rock-poly', shapes[Math.floor(Math.random() * shapes.length)]);
    rock.style.setProperty('--rock-spin', `${Math.floor(Math.random() * 360)}deg`);
  }
  document.querySelectorAll('.space-rock.small').forEach(shapeRock);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      shapeRock(node);
      node.querySelectorAll?.('.space-rock.small').forEach(shapeRock);
    }
  }).observe(document.body, { childList:true, subtree:true });

  const badge = document.createElement('div');
  badge.id = 'starryBatteryCenter';
  badge.setAttribute('aria-live', 'polite');
  const title = document.createElement('span');
  title.className = 'battery-title';
  title.textContent = '電池';
  const batteryIcon = document.createElement('span');
  batteryIcon.className = 'battery-icon';
  batteryIcon.setAttribute('aria-hidden', 'true');
  batteryIcon.textContent = '🔋';
  // Shared animation module. Rewards and ledger remain owned by this App.
  const chargeBolt = window.StarryBatteryCharge?.mount(batteryIcon) || null;
  title.prepend(batteryIcon);
  const value = document.createElement('button');
  value.type = 'button';
  value.className = 'battery-value';
  value.disabled = true;
  value.textContent = '--';
  badge.append(title, value);
  // Detached from the battery row: the menu must not change its spacing or font.
  const accountMenu = document.createElement('div');
  accountMenu.className = 'starry-battery-account-menu';
  accountMenu.id = 'starryBatteryAccountMenu';
  accountMenu.setAttribute('role', 'menu');
  accountMenu.setAttribute('aria-label', 'Starry ID 會員選單');
  accountMenu.hidden = true;
  accountMenu.innerHTML = '<button type="button" role="menuitem" data-account-action="logout">登出</button><button type="button" role="menuitem" data-account-action="switch">切換使用身分</button><button type="button" role="menuitem" data-account-action="cancel">取消</button><div class="account-menu-status" role="status" aria-live="polite"></div>';
  document.body.appendChild(accountMenu);

  const mainTitle = document.querySelector('.brand-mark h1');
  if (mainTitle) mainTitle.insertAdjacentElement('afterend', badge);
  else document.body.appendChild(badge);

  function closeLogin() {
    loginSheet?.classList.remove('open');
    loginSheet?.setAttribute('aria-hidden', 'true');
  }

  function ensureLoginSheet() {
    if (loginSheet) return loginSheet;
    const overlay = document.createElement('div');
    overlay.className = 'starry-login-backdrop';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="starry-login-sheet" role="dialog" aria-modal="true" aria-label="登入 Starry ID"><div class="starry-login-grabber"></div><button class="starry-login-close" type="button" aria-label="關閉">×</button><h2 class="starry-login-title">STARRY ID</h2><p class="starry-login-copy">選擇 Google 帳號即可登入或第一次綁定，不離開目前頁面。</p><div class="starry-google-host"></div><div class="starry-login-status" role="status">正在準備 Google 帳號…</div><button class="starry-login-fallback" type="button">Google 帳號沒有出現？改用小視窗登入</button></section>`;
    overlay.querySelector('.starry-login-close')?.addEventListener('click', closeLogin);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) closeLogin(); });
    overlay.querySelector('.starry-login-fallback')?.addEventListener('click', () => {
      window.open(LOGIN_FALLBACK_URL, 'starryGoogleLogin', 'popup=yes,width=460,height=620');
    });
    document.body.appendChild(overlay);
    loginSheet = overlay;
    return overlay;
  }

  function loginStatus(message, error = false) {
    const sheet = ensureLoginSheet();
    const status = sheet.querySelector('.starry-login-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function loadGoogleSdk() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (googleSdkPromise) return googleSdkPromise;
    googleSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      const script = existing || document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('Google 登入載入逾時')), 12000);
      const done = () => { clearTimeout(timeout); resolve(); };
      if (window.google?.accounts?.id) return done();
      script.addEventListener('load', done, { once:true });
      script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Google 登入載入失敗')); }, { once:true });
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
    return googleSdkPromise;
  }

  async function handleGoogleCredential(response) {
    const credential = String(response?.credential || '');
    if (!credential) { loginStatus('沒有取得 Google 帳號資料，請再試一次。', true); return; }
    loginStatus('正在安全登入 Starry ID…');
    try {
      const result = await fetch(LOGIN_API, {
        method:'POST', mode:'cors', credentials:'include', cache:'no-store',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ credential, appId:'starryphd' })
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok || !data?.success) throw new Error(data?.error || '登入失敗');
      loginStatus('登入成功');
      closeLogin();
      await loadBalance();
    } catch (error) {
      console.warn('Starry ID direct login:', error);
      loginStatus('目前無法直接完成登入，請使用下方小視窗登入。', true);
    }
  }

  function initializeGoogle() {
    if (googleInitialized || !window.google?.accounts?.id) return googleInitialized;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_prompt: true
    });
    googleInitialized = true;
    return true;
  }

  async function openLogin() {
    const sheet = ensureLoginSheet();
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    loginStatus('正在準備 Google 帳號…');
    try {
      await loadGoogleSdk();
      if (!initializeGoogle()) throw new Error('Google 登入尚未就緒');
      const host = sheet.querySelector('.starry-google-host');
      if (host) {
        host.replaceChildren();
        window.google.accounts.id.renderButton(host, {
          type:'standard', theme:'filled_black', size:'large', shape:'pill', text:'continue_with', logo_alignment:'left', width:300, locale:'zh_TW'
        });
      }
      loginStatus('請選擇 Google 帳號');
      setTimeout(() => {
        try { window.google.accounts.id.prompt(); } catch (_) {}
      }, 80);
    } catch (error) {
      console.warn('Google Identity Services:', error);
      loginStatus('Google 帳號選擇暫時無法顯示，請使用下方小視窗登入。', true);
    }
  }

  function renderBalance() {
    if (currentBalance === null) return;
    // Integer hundredths prevent 0.01+0.02 floating-point drift.
    const cents = Math.round(currentBalance * 100)
      + Array.from(optimisticAwards.values()).reduce((sum, amount) => sum + amount, 0);
    const visible = (cents / 100).toFixed(2);
    value.textContent = `${visible} 顆`;
    value.disabled = true;
    value.classList.remove('login-ready');
    value.setAttribute('aria-label', `目前電池 ${visible} 顆`);
    badge.dataset.accountReady = '1';
    badge.tabIndex = 0;
    badge.setAttribute('role', 'button');
    badge.setAttribute('aria-haspopup', 'menu');
    badge.setAttribute('aria-expanded', accountMenu.hidden ? 'false' : 'true');
    badge.setAttribute('aria-label', `目前電池 ${visible} 顆，開啟會員選單`);
  }

  function displayBalance(balance, fromReward = false) {
    const number = Number(balance);
    if (!Number.isFinite(number) || number < 0) return;
    // POSTs are serialized; each response confirms one queued credit.
    // The server is always authoritative; its amount may differ from preview.
    currentBalance = number; // Always display the confirmed server ledger.
    renderBalance();
  }

  function flashBattery() {
    if (currentBalance === null) return;
    window.StarryBatteryCharge?.flash(chargeBolt);
  }

  function displayLoggedOut() {
    closeAccountMenu();
    badge.dataset.accountReady = '0';
    badge.removeAttribute('role');
    badge.removeAttribute('aria-haspopup');
    badge.removeAttribute('aria-expanded');
    badge.removeAttribute('aria-label');
    badge.removeAttribute('tabindex');
    currentBalance = null;
    optimisticAwards.clear();
    value.textContent = '請先登入';
    value.disabled = false;
    value.classList.add('login-ready');
    value.setAttribute('aria-label', '請先登入 Starry ID');
  }

  function closeAccountMenu(restoreFocus = false) {
    const wasOpen = !accountMenu.hidden;
    accountMenu.hidden = true;
    badge.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus && badge.dataset.accountReady === '1') badge.focus();
  }

  function openAccountMenu() {
    if (accountTransitioning || badge.dataset.accountReady !== '1') return;
    accountMenu.querySelector('.account-menu-status').textContent = '';
    accountMenu.hidden = false;
    badge.setAttribute('aria-expanded', 'true');
    const bounds = badge.getBoundingClientRect();
    const halfWidth = accountMenu.offsetWidth / 2;
    accountMenu.style.left = `${Math.min(Math.max(bounds.left + bounds.width / 2, halfWidth + 12), window.innerWidth - halfWidth - 12)}px`;
    accountMenu.style.top = `${Math.max(8, bounds.bottom + 8)}px`;
    accountMenu.querySelector('[data-account-action="logout"]').focus();
  }

  async function performAccountExit(switchIdentity) {
    if (accountTransitioning || badge.dataset.accountReady !== '1') return;
    if (!switchIdentity && !window.confirm('確定要登出 Starry ID 嗎？其他繁星 App 可能也需要重新登入。')) return;
    accountTransitioning = true;
    const status = accountMenu.querySelector('.account-menu-status');
    const actions = accountMenu.querySelectorAll('button');
    actions.forEach(button => { button.disabled = true; });
    status.textContent = '正在確認舊帳號的電池獎勵…';
    try {
      // No new meteor credits can enter the queue during an identity transition.
      if (rewardDrainPromise) await rewardDrainPromise;
      if (rewardQueueRunning || rewardQueue.length || activeRewardRequests !== 0) {
        throw new Error('電池獎勵尚未完成，請稍後再試。');
      }
      status.textContent = '正在安全登出…';
      const response = await fetch(LOGOUT_API, { method:'POST', mode:'cors', credentials:'include', cache:'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) throw new Error('無法確認登出成功，請重試。');
      // Invalidate any earlier GET reply before presenting the next account.
      balanceGeneration++;
      balanceReadSequence++;
      optimisticAwards.clear();
      displayLoggedOut();
      try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch (_) {}
      if (switchIdentity) void openLogin();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '登出失敗，請重試。';
    } finally {
      accountTransitioning = false;
      actions.forEach(button => { button.disabled = false; });
    }
  }

  badge.addEventListener('click', () => {
    if (badge.dataset.accountReady !== '1' || accountTransitioning) return;
    if (accountMenu.hidden) openAccountMenu();
    else closeAccountMenu();
  });
  badge.addEventListener('keydown', (event) => {
    if (event.target !== badge || badge.dataset.accountReady !== '1') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (accountMenu.hidden) openAccountMenu();
      else closeAccountMenu();
    }
  });
  accountMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-account-action]')?.dataset.accountAction;
    if (action === 'cancel') closeAccountMenu(true);
    else if (action === 'logout') void performAccountExit(false);
    else if (action === 'switch') void performAccountExit(true);
  });
  document.addEventListener('pointerdown', event => {
    if (!accountMenu.hidden && !accountTransitioning && !accountMenu.contains(event.target) && !badge.contains(event.target)) closeAccountMenu();
  });
  addEventListener('scroll', () => { if (!accountTransitioning) closeAccountMenu(); }, { passive:true });
  addEventListener('resize', () => { if (!accountTransitioning) closeAccountMenu(); }, { passive:true });
  value.addEventListener('click', () => {
    if (value.classList.contains('login-ready')) void openLogin();
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeLogin(); if (!accountTransitioning) closeAccountMenu(true); }
  });
  addEventListener('message', (event) => {
    if (event.origin !== LOGIN_ORIGIN || event.data?.type !== 'starry-id-login-success') return;
    closeLogin();
    void loadBalance();
  });

  async function api(method = 'GET', body) {
    const response = await fetch(API, {
      method, mode:'cors', credentials:'include', cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:undefined,
      body:body?JSON.stringify(body):undefined
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function loadBalance() {
    if (accountTransitioning) return;
    const generation = balanceGeneration;
    const sequence = ++balanceReadSequence;
    try {
      const { response, data } = await api('GET');
      if (generation !== balanceGeneration ||
          sequence !== balanceReadSequence || activeRewardRequests) return;
      if (response.status === 401) { displayLoggedOut(); return; }
      if (!response.ok) throw new Error(data?.error || '讀取失敗');
      displayBalance(data.balance);
    } catch (error) {
      console.warn('Starry battery balance:', error);
    }
  }

  function targetId(rock) {
    if (rock.dataset.batteryTargetId) return rock.dataset.batteryTargetId;
    const id = crypto.randomUUID?.() || `meteor-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
    rock.dataset.batteryTargetId = id;
    return id;
  }

  function showReward(x, y, amount, rock) {
    const reward = Number(amount);
    if (!Number.isFinite(reward) || reward <= 0) return;
    const floater = document.createElement('span');
    floater.className = 'battery-reward-float';
    floater.dataset.batteryTargetId = rock?.dataset?.batteryTargetId || '';
    floater.textContent = `+${reward.toFixed(2)} 🔋`;
    const rewardX = Math.min(Math.max(Number(x||0)+42,56),Math.max(56,innerWidth-56));
    const rewardY = Math.min(Math.max(Number(y||0)-18,30),Math.max(30,innerHeight-30));
    floater.style.left=`${rewardX}px`;
    floater.style.top=`${rewardY}px`;
    document.body.appendChild(floater);
    setTimeout(()=>floater.remove(),950);
    // The charging flash is shown immediately at the hit, not after POST.
  }

  function failReward(rock) {
    window.dispatchEvent(new CustomEvent('starry:meteor-reward-failed',{detail:{rock}}));
  }

  function predictReward(rock, id) {
    if (currentBalance === null || value.classList.contains('login-ready')) return;
    const cents = Number(rock.dataset.batteryRewardHundredths);
    if (!Number.isInteger(cents) || cents < 1 || cents > 100) return;
    optimisticAwards.set(id, cents);
    renderBalance();
    flashBattery();
  }

  async function drainRewardQueue() {
    if (rewardQueueRunning) return;
    rewardQueueRunning = true;
    try {
      while (rewardQueue.length) {
        const { rock, x, y, id } = rewardQueue.shift();
        try {
          const sizeLevel = Number(rock.dataset.batterySizeLevel);
          const { response, data } = await api('POST',{ targetId:id, sizeLevel });
          if (response.status === 401) {
            failReward(rock);
            displayLoggedOut();
            // No more authenticated requests until the member signs in again.
            for (const item of rewardQueue.splice(0)) failReward(item.rock);
            activeRewardRequests = 1; // Finalizer below releases current item.
            break;
          }
          if (response.status === 429) { failReward(rock); continue; }
          if (!response.ok || !data.success) throw new Error(data?.error || '獎勵寫入失敗');
          const authoritative = Number(data.balance);
          if (!Number.isFinite(authoritative) || authoritative < 0) throw new Error('無效電池總量');
          // Remove this prediction before incorporating the confirmed server total.
          optimisticAwards.delete(id);
          const added = Number(data.added || 0);
          if (!data.duplicate && added > 0) showReward(x, y, added, rock);
          else failReward(rock);
          displayBalance(authoritative, true);
        } catch (error) {
          failReward(rock);
          console.warn('Starry battery reward:', error);
        } finally {
          optimisticAwards.delete(id);
          activeRewardRequests = Math.max(0, activeRewardRequests - 1);
          renderBalance(); // Failed or duplicate credits roll back immediately.
        }
      }
    } finally {
      rewardQueueRunning = false;
    }
  }

  function rewardMeteor(rock, x, y) {
    if (accountTransitioning || !(rock instanceof HTMLElement) || rock.dataset.batteryRewardSent === '1') return;
    rock.dataset.batteryRewardSent = '1';
    const id = targetId(rock);
    balanceGeneration++; // Invalidate in-flight GET before showing the estimate.
    activeRewardRequests++;
    predictReward(rock, id);
    rewardQueue.push({ rock, x, y, id });
    rewardDrainPromise = drainRewardQueue();
    const settling = rewardDrainPromise;
    void settling.then(() => {
      if (rewardDrainPromise === settling && !rewardQueueRunning && !rewardQueue.length) rewardDrainPromise = null;
    });
  }

  addEventListener('starry:meteor-blasted',(event)=>{
    const detail=event instanceof CustomEvent?event.detail:null;
    if (!(detail?.rock instanceof HTMLElement)) return;
    rewardMeteor(detail.rock, detail.x, detail.y);
  });

  void loadBalance();
  addEventListener('pageshow',()=>void loadBalance());
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) void loadBalance(); });
})();
