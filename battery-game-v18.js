(() => {
  const API = 'https://id.starry.phd/api/starry-game/battery';
  let currentBalance = null;

  document.getElementById('freeLookHint')?.remove();

  const style = document.createElement('style');
  style.textContent = `
    #starryBatteryCenter{
      position:fixed;
      z-index:25;
      left:50%;
      top:max(166px,calc(env(safe-area-inset-top) + 154px));
      transform:translateX(-50%);
      min-width:132px;
      padding:7px 11px 7px;
      border:1px solid rgba(125,249,255,.24);
      border-radius:12px;
      background:rgba(3,9,24,.5);
      box-shadow:0 0 18px rgba(68,169,255,.14),inset 0 0 14px rgba(125,249,255,.03);
      backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px);
      text-align:center;
      pointer-events:none;
      color:#f4fcff;
      text-shadow:0 0 10px rgba(125,249,255,.24);
      user-select:none;
    }
    #starryBatteryCenter .battery-title{
      display:block;
      margin-bottom:2px;
      color:rgba(179,229,255,.7);
      font:600 8px/1.15 "Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.09em;
    }
    #starryBatteryCenter .battery-value{
      display:block;
      font:700 18px/1.12 "Noto Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;
      font-variant-numeric:tabular-nums;
      font-feature-settings:"zero" 0;
      letter-spacing:.02em;
    }
    #starryBatteryCenter .battery-hint{
      display:block;
      margin-top:3px;
      color:rgba(212,240,255,.62);
      font:500 8px/1.18 "Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.02em;
    }
    #starryBatteryCenter.rewarded{
      animation:batteryRewardGlow .58s ease-out;
    }
    .battery-reward-float{
      position:fixed;
      z-index:95;
      transform:translate(-50%,-50%);
      pointer-events:none;
      color:#fff4a9;
      font:800 17px/1 "Noto Sans TC",system-ui,sans-serif;
      text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);
      animation:batteryRewardFloat .9s cubic-bezier(.16,.9,.25,1) forwards;
    }
    @keyframes batteryRewardGlow{
      0%{box-shadow:0 0 18px rgba(68,169,255,.14)}
      35%{box-shadow:0 0 30px rgba(255,220,86,.9),0 0 62px rgba(255,133,35,.34)}
      100%{box-shadow:0 0 18px rgba(68,169,255,.14)}
    }
    @keyframes batteryRewardFloat{
      0%{opacity:0;transform:translate(-50%,-30%) scale(.72)}
      18%{opacity:1;transform:translate(-50%,-70%) scale(1.12)}
      100%{opacity:0;transform:translate(-50%,-170%) scale(.96)}
    }
    @media(max-width:760px){
      #starryBatteryCenter{
        top:max(150px,calc(env(safe-area-inset-top) + 138px));
        min-width:122px;
        padding:6px 9px;
        border-radius:11px;
      }
      #starryBatteryCenter .battery-value{font-size:16px}
      #starryBatteryCenter .battery-title{font-size:7px}
      #starryBatteryCenter .battery-hint{font-size:7px}
    }
  `;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.id = 'starryBatteryCenter';
  badge.setAttribute('aria-live', 'polite');
  const title = document.createElement('span');
  title.className = 'battery-title';
  title.textContent = '🔋 STARRY 電池';
  const value = document.createElement('strong');
  value.className = 'battery-value';
  value.textContent = '--';
  const hint = document.createElement('span');
  hint.className = 'battery-hint';
  hint.textContent = '讀取中央會員電池…';
  badge.append(title, value, hint);
  document.body.appendChild(badge);

  function displayBalance(balance) {
    const number = Number(balance);
    if (!Number.isFinite(number)) return;
    currentBalance = number;
    value.textContent = `${number.toFixed(2)} 顆`;
    hint.textContent = '點擊隕石爆破 +0.01';
  }

  function displayLoggedOut() {
    currentBalance = null;
    value.textContent = '--';
    hint.textContent = '登入 Starry ID 後可累積電池';
  }

  function displayError(message = '電池暫時無法讀取') {
    hint.textContent = message;
  }

  async function api(method = 'GET', body) {
    const response = await fetch(API, {
      method,
      mode: 'cors',
      credentials: 'include',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function loadBalance() {
    try {
      const { response, data } = await api('GET');
      if (response.status === 401) {
        displayLoggedOut();
        return;
      }
      if (!response.ok) throw new Error(data?.error || '讀取失敗');
      displayBalance(data.balance);
    } catch (error) {
      console.warn('Starry battery balance:', error);
      displayError();
    }
  }

  function targetId(rock) {
    if (rock.dataset.batteryTargetId) return rock.dataset.batteryTargetId;
    const id = crypto.randomUUID?.() || `meteor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    rock.dataset.batteryTargetId = id;
    return id;
  }

  function showReward(x, y) {
    const floater = document.createElement('span');
    floater.className = 'battery-reward-float';
    floater.textContent = '+0.01 🔋';
    floater.style.left = `${x}px`;
    floater.style.top = `${y}px`;
    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 1000);
    badge.classList.remove('rewarded');
    void badge.offsetWidth;
    badge.classList.add('rewarded');
    setTimeout(() => badge.classList.remove('rewarded'), 650);
  }

  async function rewardMeteor(rock, x, y) {
    if (!(rock instanceof HTMLElement) || rock.dataset.batteryRewardSent === '1') return;
    rock.dataset.batteryRewardSent = '1';
    const id = targetId(rock);

    try {
      const { response, data } = await api('POST', { targetId: id });
      if (response.status === 401) {
        displayLoggedOut();
        return;
      }
      if (response.status === 429) {
        if (Number.isFinite(Number(data.balance))) displayBalance(data.balance);
        displayError('點太快，這顆不計入獎勵');
        setTimeout(() => currentBalance !== null && displayBalance(currentBalance), 1200);
        return;
      }
      if (!response.ok || !data.success) throw new Error(data?.error || '獎勵寫入失敗');
      displayBalance(data.balance);
      if (Number(data.added) === 0.01) showReward(Number(x || 0), Number(y || 0));
    } catch (error) {
      console.warn('Starry battery reward:', error);
      displayError('爆破成功，但電池寫入失敗');
      setTimeout(() => currentBalance !== null && displayBalance(currentBalance), 1500);
    }
  }

  window.addEventListener('starry:meteor-blasted', (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!(detail?.rock instanceof HTMLElement)) return;
    void rewardMeteor(detail.rock, detail.x, detail.y);
  });

  void loadBalance();
  addEventListener('pageshow', () => void loadBalance());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadBalance();
  });
})();
