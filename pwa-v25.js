(() => {
  // Web First / PWA Ready / Capacitor Ready：平台功能集中在輕量層，不改動主程式。
  const APP_NAME = '繁星艦長';

  function ensureLink(rel, href, extra = {}) {
    let link = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    }
    Object.entries(extra).forEach(([key, value]) => link.setAttribute(key, value));
    return link;
  }

  function ensureMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  }

  ensureLink('manifest', '/manifest.webmanifest');
  ensureLink('icon', '/icon-192.png', { type:'image/png', sizes:'192x192' });
  ensureLink('apple-touch-icon', '/icon-192.png', { sizes:'192x192' });
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', APP_NAME);
  ensureMeta('application-name', APP_NAME);

  let deferredInstallPrompt = null;
  let installedInThisSession = false;
  addEventListener('appinstalled', () => {
    installedInThisSession = true;
    deferredInstallPrompt = null;
  });
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dispatchEvent(new CustomEvent('starry:pwa-install-ready'));
  });

  window.starryPlatform = window.starryPlatform || {};
  window.starryPlatform.installPwa = async () => {
    const installed = installedInThisSession || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (installed) return { available:false, installed:true };
    if (!deferredInstallPrompt) return { available:false, installed:false };
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => ({ outcome:'dismissed' }));
    if (choice?.outcome === 'accepted') deferredInstallPrompt = null;
    return { available:true, installed:false, outcome:choice?.outcome || 'dismissed' };
  };
  window.starryPlatform.isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.starryPlatform.isKnownInstalled = () => installedInThisSession || window.starryPlatform.isStandalone();

  function isIosLike() {
    return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function showInstallStatus(text) {
    const modal = document.getElementById('portalModal');
    const message = document.getElementById('portalMessage');
    if (message) message.textContent = text;
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function showInstallUnavailable() {
    showInstallStatus('無法確認是否已安裝。若已安裝請從桌面開啟；否則可使用瀏覽器的「安裝應用程式／加入桌面」功能。');
  }

  const playButton = document.querySelector('.portal-btn[data-store="Google Play"]');
  if (playButton) {
    playButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      // Standalone and appinstalled are reliable. A normal browser tab cannot
      // always discover whether this PWA is installed elsewhere on the device.
      if (window.starryPlatform.isKnownInstalled()) {
        showInstallStatus('已安裝繁星艦長，可從桌面直接開啟。');
        return;
      }
      if (isIosLike()) {
        showInstallStatus('無法確認是否已安裝。iPhone/iPad 請查看主畫面；尚未安裝請使用 Safari 的「加入主畫面」。');
        return;
      }
      try {
        const result = await window.starryPlatform.installPwa();
        if (result?.installed) {
          showInstallStatus('已安裝繁星艦長，可從桌面直接開啟。');
        } else if (!result?.available) {
          showInstallUnavailable();
        } else if (result.outcome === 'accepted') {
          showInstallStatus('已送出安裝請求，請依瀏覽器提示完成；安裝完成後可從桌面開啟。');
        } else {
          showInstallStatus('尚未完成安裝。需要時可再次按下安裝按鈕。');
        }
      } catch (error) {
        console.warn('Starry PWA installation:',error);
        showInstallUnavailable();
      }
    }, true);
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope:'/' }).catch((error) => {
        console.warn('Starry PWA service worker:', error);
      });
    }, { once:true });
  }
})();
