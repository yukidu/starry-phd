(() => {
  // Web First：目前走共用 Starry ID Web API；未來 Capacitor / Android / iOS
  // 仍沿用同一會員、API 與中央電池資料，不把平台邏輯綁死在本頁。
  const API = 'https://id.starry.phd/api/starry-game/battery';
  const LOGIN_URL = 'https://id.starry.phd/starry-main-login';
  const LOGIN_ORIGIN = 'https://id.starry.phd';
  let currentBalance = null;
  let loginOverlay = null;

  document.getElementById('freeLookHint')?.remove();

  const style = document.createElement('style');
  style.textContent = `
    .free-look-hint{display:none!important}
    #starryBatteryCenter{position:relative;z-index:25;display:inline-flex;align-items:baseline;justify-content:center;gap:4px 10px;margin:10px auto 0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;text-align:center;color:#f4fcff;text-shadow:0 0 12px rgba(125,249,255,.28);user-select:none}
    #starryBatteryCenter .battery-title{display:inline;margin:0;color:rgba(179,229,255,.82);font:700 clamp(14px,1.5vw,18px)/1.15 "Noto Sans TC",system-ui,sans-serif;letter-spacing:.06em;pointer-events:none}
    #starryBatteryCenter .battery-value{display:inline;margin:0;padding:0;border:0;background:none;color:#f4fcff;font:800 clamp(26px,2.7vw,34px)/1.08 "Noto Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:"zero" 0;letter-spacing:.01em;text-shadow:inherit}
    #starryBatteryCenter .battery-value:disabled{opacity:1;color:#f4fcff}
    #starryBatteryCenter .battery-value.login-ready{cursor:pointer;color:#fff4b8;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px;text-decoration-color:rgba(255,237,158,.42);pointer-events:auto}
    #starryBatteryCenter .battery-value.login-ready:focus-visible{outline:2px solid rgba(125,249,255,.8);outline-offset:5px;border-radius:4px}
    #starryBatteryCenter.rewarded{animation:batteryRewardGlow .58s ease-out}
    .battery-reward-float{position:fixed;z-index:95;transform:translate(-50%,-50%);pointer-events:none;color:#fff4a9;font:800 18px/1 "Noto Sans TC",system-ui,sans-serif;text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);animation:batteryRewardFloat .78s cubic-bezier(.16,.9,.25,1) forwards}
    @keyframes batteryRewardGlow{0%,100%{filter:none}35%{filter:drop-shadow(0 0 12px rgba(255,220,86,.9))}}
    @keyframes batteryRewardFloat{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}22%{opacity:1;transform:translate(-50%,-72%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-155%) scale(.96)}}

    .starry-login-overlay{position:fixed;inset:0;z-index:130;display:grid;place-items:center;padding:16px;background:rgba(0,3,13,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease}
    .starry-login-overlay.open{opacity:1;visibility:visible}
    .starry-login-panel{position:relative;width:min(460px,calc(100vw - 24px));height:min(520px,calc(100dvh - 38px));min-height:390px;border:1px solid rgba(142,225,255,.25);border-radius:24px;overflow:hidden;background:#050714;box-shadow:0 28px 90px rgba(0,0,0,.58),0 0 38px rgba(68,169,255,.12)}
    .starry-login-frame{display:block;width:100%;height:100%;border:0;background:#050714}
    .starry-login-close{position:absolute;z-index:2;right:10px;top:10px;width:38px;height:38px;border:1px solid rgba(190,230,255,.24);border-radius:50%;background:rgba(5,10,25,.84);color:#effaff;font-size:21px;line-height:1;cursor:pointer}
    @media(max-width:760px){#starryBatteryCenter{margin-top:8px;gap:3px 8px}#starryBatteryCenter .battery-value{font-size:26px}#starryBatteryCenter .battery-title{font-size:14px}.starry-login-overlay{padding:8px}.starry-login-panel{width:calc(100vw - 16px);height:min(540px,calc(100dvh - 16px));border-radius:20px}}
  `;
  document.head.appendChild(style);

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

  function ensureLoginOverlay() {
    if (loginOverlay) return loginOverlay;
    const overlay = document.createElement('div');
    overlay.className = 'starry-login-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="starry-login-panel" role="dialog" aria-modal="true" aria-label="登入 Starry ID"><button class="starry-login-close" type="button" aria-label="關閉登入">×</button><iframe class="starry-login-frame" title="登入 Starry ID" allow="identity-credentials-get"></iframe></section>`;
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      const frame = overlay.querySelector('.starry-login-frame');
      if (frame) frame.removeAttribute('src');
    };
    overlay.querySelector('.starry-login-close')?.addEventListener('click', close);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
    overlay.closeLogin = close;
    document.body.appendChild(overlay);
    loginOverlay = overlay;
    return overlay;
  }

  function openLogin() {
    const overlay = ensureLoginOverlay();
    const frame = overlay.querySelector('.starry-login-frame');
    if (frame && !frame.getAttribute('src')) frame.setAttribute('src', LOGIN_URL);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    overlay.querySelector('.starry-login-close')?.focus({ preventScroll:true });
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
    if (value.classList.contains('login-ready')) openLogin();
  });

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && loginOverlay?.classList.contains('open')) loginOverlay.closeLogin?.();
  });

  addEventListener('message', (event) => {
    if (event.origin !== LOGIN_ORIGIN || event.data?.type !== 'starry-id-login-success') return;
    loginOverlay?.closeLogin?.();
    void loadBalance();
  });

  async function api(method = 'GET', body) {
    const response = await fetch(API, { method, mode:'cors', credentials:'include', cache:'no-store', headers:body?{'Content-Type':'application/json'}:undefined, body:body?JSON.stringify(body):undefined });
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

  function showReward(x, y) {
    const floater = document.createElement('span');
    floater.className = 'battery-reward-float';
    floater.textContent = '+0.01 🔋';
    const rewardX = Math.min(Math.max(Number(x||0)+42,56),Math.max(56,innerWidth-56));
    const rewardY = Math.min(Math.max(Number(y||0)-18,30),Math.max(30,innerHeight-30));
    floater.style.left=`${rewardX}px`; floater.style.top=`${rewardY}px`;
    document.body.appendChild(floater); setTimeout(()=>floater.remove(),850);
    badge.classList.remove('rewarded'); void badge.offsetWidth; badge.classList.add('rewarded'); setTimeout(()=>badge.classList.remove('rewarded'),650);
  }

  async function rewardMeteor(rock) {
    if (!(rock instanceof HTMLElement) || rock.dataset.batteryRewardSent === '1') return;
    rock.dataset.batteryRewardSent='1';
    try {
      const { response, data } = await api('POST',{ targetId:targetId(rock) });
      if (response.status===401) { displayLoggedOut(); return; }
      if (response.status===429) { if (Number.isFinite(Number(data.balance))) displayBalance(data.balance); return; }
      if (!response.ok || !data.success) throw new Error(data?.error||'獎勵寫入失敗');
      displayBalance(data.balance);
    } catch (error) { console.warn('Starry battery reward:',error); }
  }

  addEventListener('starry:meteor-blasted',(event)=>{
    const detail=event instanceof CustomEvent?event.detail:null;
    if (!(detail?.rock instanceof HTMLElement)) return;
    if (currentBalance!==null && detail.rock.dataset.batteryRewardVisualShown!=='1') {
      detail.rock.dataset.batteryRewardVisualShown='1'; showReward(detail.x,detail.y);
    }
    void rewardMeteor(detail.rock);
  });

  void loadBalance();
  addEventListener('pageshow',()=>void loadBalance());
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) void loadBalance(); });
})();
