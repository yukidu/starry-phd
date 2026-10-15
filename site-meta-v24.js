(() => {
  const title = '繁星生態系 Starry.phd';
  document.title = title;

  function setMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  setMeta('application-name', title);
  setMeta('apple-mobile-web-app-title', title);
})();
