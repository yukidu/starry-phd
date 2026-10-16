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
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dispatchEvent(new CustomEvent('starry:pwa-install-ready'));
  });

  window.starryPlatform = window.starryPlatform || {};
  window.starryPlatform.installPwa = async () => {
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (installed) return { available:false, installed:true };
    if (!deferredInstallPrompt) return { available:false, installed:false };
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => ({ outcome:'dismissed' }));
    if (choice?.outcome === 'accepted') deferredInstallPrompt = null;
    return { available:true, installed:false, outcome:choice?.outcome || 'dismissed' };
  };
  window.starryPlatform.isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function isIosLike() {
    return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function showInstallUnavailable() {
    const modal = document.getElementById('portalModal');
    const message = document.getElementById('portalMessage');
    if (message) message.textContent = '此瀏覽器目前未提供一鍵安裝，請使用瀏覽器的「安裝應用程式／加入桌面」功能。';
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  const playButton = document.querySelector('.portal-btn[data-store="Google Play"]');
  if (playButton && !isIosLike()) {
    playButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const result = await window.starryPlatform.installPwa();
      if (result?.installed) return;
      if (!result?.available) showInstallUnavailable();
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
