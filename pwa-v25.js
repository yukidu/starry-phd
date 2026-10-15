(() => {
  // Web First / PWA Ready / Capacitor Ready：平台功能集中在輕量層，不改動主程式。
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
  ensureMeta('apple-mobile-web-app-title', '繁星生態系 Starry.phd');
  ensureMeta('application-name', '繁星生態系 Starry.phd');

  let deferredInstallPrompt = null;
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dispatchEvent(new CustomEvent('starry:pwa-install-ready'));
  });

  // 未來 App / PWA 共用入口；若需要自訂「安裝」按鈕可直接呼叫此方法。
  window.starryPlatform = window.starryPlatform || {};
  window.starryPlatform.installPwa = async () => {
    if (!deferredInstallPrompt) return { available:false };
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => ({ outcome:'dismissed' }));
    if (choice?.outcome === 'accepted') deferredInstallPrompt = null;
    return { available:true, outcome:choice?.outcome || 'dismissed' };
  };
  window.starryPlatform.isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope:'/' }).catch((error) => {
        console.warn('Starry PWA service worker:', error);
      });
    }, { once:true });
  }
})();
