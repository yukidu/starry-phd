(() => {
  // v32：所有目前可見的星球都保持完全不透明；離開視野的星球仍維持隱藏。
  const style = document.createElement('style');
  style.textContent = `
    .planet-wrap{opacity:1!important}
    .planet-wrap[style*="opacity: 0;"]{visibility:hidden!important}
    .planet-wrap:not([style*="opacity: 0;"]){visibility:visible!important}
    .planet-wrap .planet,.planet-wrap .planet>span{opacity:1!important}
  `;
  document.head.appendChild(style);
})();
