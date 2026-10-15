(() => {
  // Web First：目前走共用 Starry ID Web API；未來 Capacitor / Android / iOS
  // 仍沿用同一會員、API 與中央電池資料，不把平台邏輯綁死在本頁。
  const API = 'https://id.starry.phd/api/starry-game/battery';
  let currentBalance = null;

  // 舊的 360° 探索提示框完全移除。
  document.getElementById('freeLookHint')?.remove();

  const style = document.createElement('style');
  style.textContent = `
    .free-look-hint{display:none!important}
    #starryBatteryCenter{
      position:relative;
      z-index:25;
      display:inline-flex;
      align-items:baseline;
      justify-content:center;
      gap:4px 10px;
      margin:10px auto 0;
      padding:0;
      border:0;
      border-radius:0;
      background:transparent;
      box-shadow:none;
      backdrop-filter:none;
      -webkit-backdrop-filter:none;
      text-align:center;
      pointer-events:none;
      color:#f4fcff;
      text-shadow:0 0 12px rgba(125,249,255,.28);
      user-select:none;
    }
    #starryBatteryCenter .battery-title{
      display:inline;
      margin:0;
      color:rgba(179,229,255,.82);
      font:700 clamp(14px,1.5vw,18px)/1.15 "Noto Sans TC",system-ui,sans-serif;
      letter-spacing:.06em;
    }
    #starryBatteryCenter .battery-value{
      display:inline;
      font:800 clamp(26px,2.7vw,34px)/1.08 "Noto Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;
      font-variant-numeric:tabular-nums;
      font-feature-settings:"zero" 0;
      letter-spacing:.01em;
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
      font:800 18px/1 "Noto Sans TC",system-ui,sans-serif;
      text-shadow:0 0 8px #ffcf54,0 0 22px rgba(255,148,39,.9);
      animation:batteryRewardFloat .78s cubic-bezier(.16,.9,.25,1) forwards;
    }
    @keyframes batteryRewardGlow{
      0%,100%{filter:none}
      35%{filter:drop-shadow(0 0 12px rgba(255,220,86,.9))}
    }
    @keyframes batteryRewardFloat{
      0%{opacity:1;transform:translate(-50%,-50%) scale(1)}
      22%{opacity:1;transform:translate(-50%,-72%) scale(1.1)}
      100%{opacity:0;transform:translate(-50%,-155%) scale(.96)}
    }
    @media(max-width:760px){
      #starryBatteryCenter{margin-top:8px;gap:3px 8px}
      #starryBatteryCenter .battery-value{font-size:26px}
      #starryBatteryCenter .battery-title{font-size:14px}
    }
  `;
  document.head.appendChild(style);

  const badge = document.createElement('div');
  badge.id = 'starryBatteryCenter';
  badge.setAttribute('aria-live', 'polite');
  const title = document.createElement('span');
  title.className = 'battery-title';
  title.textContent = '🔋 電池';
  const value = document.createElement('strong');
  value.className = 'battery-value';
  value.textContent = '--';
  badge.append(title, value);

  const mainTitle = document.querySelector('.brand-mark h1');
  if (mainTitle) mainTitle.insertAdjacentElement('afterend', badge);
  else document.body.appendChild(badge);

  function displayBalance(balance) {
    const number = Number(balance);
    if (!Number.isFinite(number)) return;
    currentBalance = number;
    value.textContent = `${number.toFixed(2)} 顆`;
  }

  function displayLoggedOut() {
    currentBalance = null;
    value.textContent = '請登入';
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

    // 獎勵文字立即出現在點擊爆破位置的旁邊，並避免超出畫面。
    const rewardX = Math.min(Math.max(Number(x || 0) + 42, 56), Math.max(56, window.innerWidth - 56));
    const rewardY = Math.min(Math.max(Number(y || 0) - 18, 30), Math.max(30, window.innerHeight - 30));
    floater.style.left = `${rewardX}px`;
    floater.style.top = `${rewardY}px`;
    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 850);

    badge.classList.remove('rewarded');
    void badge.offsetWidth;
    badge.classList.add('rewarded');
    setTimeout(() => badge.classList.remove('rewarded'), 650);
  }

  async function rewardMeteor(rock) {
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
        return;
      }
      if (!response.ok || !data.success) throw new Error(data?.error || '獎勵寫入失敗');
      displayBalance(data.balance);
    } catch (error) {
      console.warn('Starry battery reward:', error);
    }
  }

  window.addEventListener('starry:meteor-blasted', (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!(detail?.rock instanceof HTMLElement)) return;

    // 爆破事件發生當下立即顯示，不等待中央資料庫回應。
    if (currentBalance !== null && detail.rock.dataset.batteryRewardVisualShown !== '1') {
      detail.rock.dataset.batteryRewardVisualShown = '1';
      showReward(detail.x, detail.y);
    }
    void rewardMeteor(detail.rock);
  });

  void loadBalance();
  addEventListener('pageshow', () => void loadBalance());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadBalance();
  });
})();
