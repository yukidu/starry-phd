// Keep every planet opaque internally, but let the projected group use its
// real inline opacity. The previous !important override + visibility toggle
// made otherwise visible planets pop in/out abruptly while dragging.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .planet-wrap{filter:none!important;backface-visibility:visible!important;opacity:1!important;transition:none!important}
    .planet-wrap .planet,.planet-wrap .planet>span{opacity:1!important}
  `;
  document.head.appendChild(style);
})();
