(() => {
  // Web First：主站直接使用 Google Identity Services，會員與電池仍由中央 Starry ID 管理。
  const API = 'https://id.starry.phd/api/starry-game/battery';
  const LOGIN_API = 'https://id.starry.phd/api/google-sync';
  const LOGIN_FALLBACK_URL = 'https://id.starry.phd/starry-main-login';
  const LOGIN_ORIGIN = 'https://id.starry.phd';
  const GOOGLE_CLIENT_ID = '661055525630-ndcq5gtr16h7rqqprlqqkkvineea87lc.apps.googleusercontent.com';
  let currentBalance = null;
  let loginSheet = null;
  let googleInitialized = false;
  let googleSdkPromise = null;

  document.getElementById('freeLookHint')?.remove();

  const style = document.createElement('style');
  style.textContent = `
    .free-look-hint{display:none!important}
    #immersiveToggle{display:none!important}
    #starryBatteryCenter{position:relative;z-index:25;display:inline-flex;align-items:center;justify-content:center;gap:4px 10px;margin:10px auto 0;padding:0;border:0;background:transparent;text-align:center;color:#f4fcff;text-shadow:0 0 12px rgba(125,249,255,.28);user-select:none}
    #starryBatteryCenter .battery-title{display:inline;margin:0;color:rgba(179,229,255,.82);font:700 clamp(14px,1.5vw,18px)/1.15 "Noto Sans TC",system-ui,sans-serif;letter-spacing:.06em;pointer-events:none}
    #starryBatteryCenter .battery-value{position:relative;display:inline;margin:0;padding:0;border:0;background:none;color:#f4fcff;font:800 clamp(26px,2.7vw,34px)/1.08 "Noto Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.01em;text-shadow:inherit;overflow:hidden}
    #starryBatteryCenter .battery-value:disabled{opacity:1;color:#f4fcff}
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
    @media(max-width:760px){#starryBatteryCenter{margin-top:8px;gap:3px 8px}#starryBatteryCenter .battery-value{font-size:26px}#starryBatteryCenter .battery-title{font-size:14px}#starryBatteryCenter .battery-value.login-ready{min-height:36px;padding:8px 14px 8px 16px;font-size:12px}.starry-login-sheet{padding:22px 14px 18px}.starry-login-title{font-size:18px}}
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
  title.textContent = '🔋 電池';
  const value = document.createElement('button');
  value.type = 'button';
  value.className = 'battery-value';
  value.disabled = true;
  value.textContent = '--';
  badge.append(title, value);

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

  function displayBalance(balance) {
    const number = Number(balance);
    if (!Number.isFinite(number)) return;
    currentBalance = number;
    value.textContent = `${number.toFixed(2)} 顆`;
    value.disabled = true;
    value.classList.remove('login-ready');
    value.setAttribute('aria-label', `目前電池 ${number.toFixed(2)} 顆`);
  }

  function displayLoggedOut() {
    currentBalance = null;
    value.textContent = '請先登入';
    value.disabled = false;
    value.classList.add('login-ready');
    value.setAttribute('aria-label', '請先登入 Starry ID');
  }

  value.addEventListener('click', () => {
    if (value.classList.contains('login-ready')) void openLogin();
  });
  addEventListener('keydown', (event) => { if (event.key === 'Escape') closeLogin(); });
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
    try {
      const { response, data } = await api('GET');
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
    badge.classList.remove('rewarded');
    void badge.offsetWidth;
    badge.classList.add('rewarded');
    setTimeout(()=>badge.classList.remove('rewarded'),650);
  }

  async function rewardMeteor(rock, x, y) {
    if (!(rock instanceof HTMLElement) || rock.dataset.batteryRewardSent === '1') return;
    rock.dataset.batteryRewardSent='1';
    try {
      const sizeLevel = Number(rock.dataset.batterySizeLevel);
      const { response, data } = await api('POST',{ targetId:targetId(rock), sizeLevel });
      if (response.status===401) { window.dispatchEvent(new CustomEvent('starry:meteor-reward-failed',{detail:{rock}})); displayLoggedOut(); return; }
      if (response.status===429) { window.dispatchEvent(new CustomEvent('starry:meteor-reward-failed',{detail:{rock}})); if (Number.isFinite(Number(data.balance))) displayBalance(data.balance); return; }
      if (!response.ok || !data.success) throw new Error(data?.error||'獎勵寫入失敗');
      const added = Number(data.added || 0);
      if (!data.duplicate && added > 0) showReward(x, y, added, rock);
      else window.dispatchEvent(new CustomEvent('starry:meteor-reward-failed',{detail:{rock}}));
      displayBalance(data.balance);
    } catch (error) {
      window.dispatchEvent(new CustomEvent('starry:meteor-reward-failed',{detail:{rock}}));
      console.warn('Starry battery reward:',error);
    }
  }

  addEventListener('starry:meteor-blasted',(event)=>{
    const detail=event instanceof CustomEvent?event.detail:null;
    if (!(detail?.rock instanceof HTMLElement)) return;
    void rewardMeteor(detail.rock, detail.x, detail.y);
  });

  void loadBalance();
  addEventListener('pageshow',()=>void loadBalance());
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) void loadBalance(); });
})();
