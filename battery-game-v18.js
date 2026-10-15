(() => {
  const API = 'https://id.starry.phd/api/starry-game/battery';
  let currentBalance = null;

  const style = document.createElement('style');
  style.textContent = `
    #starryBatteryCenter{
      position:fixed;
      z-index:25;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      min-width:172px;
      padding:12px 18px 11px;
      border:1px solid rgba(125,249,255,.28);
      border-radius:18px;
      background:rgba(3,9,24,.56);
      box-shadow:0 0 24px rgba(68,169,255,.18),inset 0 0 20px rgba(125,249,255,.04);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      text-align:center;
      pointer-events:none;
      color:#f4fcff;
      text-shadow:0 0 12px rgba(125,249,255,.28);
      user-select:none;
    }
    #starryBatteryCenter .battery-title{
      display:block;
      margin-bottom:4px;
      color:rgba(179,229,255,.72);
      font:600 10px/1.2 "Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.12em;
    }
    #starryBatteryCenter .battery-value{
      display:block;
      font:800 25px/1.12 "Orbitron","Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.04em;
    }
    #starryBatteryCenter .battery-hint{
      display:block;
      margin-top:5px;
      color:rgba(212,240,255,.66);
      font:600 9px/1.25 "Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.04em;
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
      font:800 17px/1 "Orbitron","Noto Sans TC",system-ui,sans-serif;
      text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);
      animation:batteryRewardFloat .9s cubic-bezier(.16,.9,.25,1) forwards;
    }
    @keyframes batteryRewardGlow{
      0%{box-shadow:0 0 24px rgba(68,169,255,.18)}
      35%{box-shadow:0 0 34px rgba(255,220,86,.92),0 0 70px rgba(255,133,35,.38)}
      100%{box-shadow:0 0 24px rgba(68,169,255,.18)}
    }
    @keyframes batteryRewardFloat{
      0%{opacity:0;transform:translate(-50%,-30%) scale(.72)}
      18%{opacity:1;transform:translate(-50%,-70%) scale(1.12)}
      100%{opacity:0;transform:translate(-50%,-170%) scale(.96)}
    }
    @media(max-width:760px){
      #starryBatteryCenter{min-width:146px;padding:9px 13px 8px;border-radius:15px}
      #starryBatteryCenter .battery-value{font-size:20px}
      #starryBatteryCenter .battery-title{font-size:9px}
      #starryBatteryCenter .battery-hint{font-size:8px}
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

  async function rewardMeteor(rock, event) {
    if (rock.dataset.batteryRewardSent === '1') return;
    rock.dataset.batteryRewardSent = '1';
    const id = targetId(rock);
    const x = Number(event.clientX || 0);
    const y = Number(event.clientY || 0);

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
      if (Number(data.added) === 0.01) showReward(x, y);
    } catch (error) {
      console.warn('Starry battery reward:', error);
      displayError('爆破成功，但電池寫入失敗');
      setTimeout(() => currentBalance !== null && displayBalance(currentBalance), 1500);
    }
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('.space-rock.small[data-interactive-meteor="1"]') : null;
    if (!(target instanceof HTMLElement)) return;
    void rewardMeteor(target, event);
  }, true);

  void loadBalance();
  addEventListener('pageshow', () => void loadBalance());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadBalance();
  });
})();
