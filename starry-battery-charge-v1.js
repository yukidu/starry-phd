/* Starry Battery Charge v1 — reusable across the Starry.phd ecosystem.
 * Visual only: no Starry ID, balance logic, network calls or framework needed.
 * Public API: StarryBatteryCharge.mount(host), .flash(svg), .remove(svg).
 * The app decides WHEN a battery credit qualifies; rapid flashes never stack.
 */
(() => {
  'use strict';
  const namespace = 'http://www.w3.org/2000/svg';
  const styleId = 'starry-battery-charge-style-v1';
  function installStyle() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.starry-battery-charge-bolt{position:absolute;left:50%;top:50%;width:124px;height:144px;',
      'z-index:2;opacity:0;pointer-events:none;overflow:visible;',
      'transform:translate3d(-50%,-50%,0) scale(.3);transform-origin:center;',
      'will-change:transform,opacity;contain:layout style}',
      '@media(prefers-reduced-motion:reduce){.starry-battery-charge-bolt{will-change:auto}}'
    ].join('');
    document.head.appendChild(style);
  }
  function mount(host) {
    if (!host || typeof host.appendChild !== 'function') return null;
    installStyle();
    // A fresh icon per App location; never silently reparent a different icon.
    const bolt = document.createElementNS(namespace, 'svg');
    bolt.classList.add('starry-battery-charge-bolt');
    bolt.setAttribute('viewBox', '0 0 80 80');
    bolt.setAttribute('aria-hidden', 'true');
    bolt.setAttribute('focusable', 'false');
    bolt.innerHTML = '<path d="M46 4 18 41h17l-8 35 37-47H44l7-25Z" fill="#9dff35" stroke="#28ee91" stroke-width="4" stroke-linejoin="round"/><path d="M46 16 29 38h15L36 61l19-27H40Z" fill="#f7ffda"/>';
    host.appendChild(bolt);
    return bolt;
  }
  function flash(bolt) {
    if (!bolt || typeof bolt.animate !== 'function') return false;
    // Do not queue dozens of animations during consecutive rewards.
    for (const animation of (bolt.getAnimations?.() || [])) animation.cancel();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const frames = reduced
      ? [{opacity:0},{opacity:1},{opacity:0}]
      : [
          {opacity:0,transform:'translate3d(-50%,-50%,0) scale(.3)'},
          {opacity:1,transform:'translate3d(-50%,-50%,0) scale(1.27)',offset:.22},
          {opacity:.95,transform:'translate3d(-50%,-50%,0) scale(1.12)',offset:.54},
          {opacity:0,transform:'translate3d(-50%,-50%,0) scale(.78)'}
        ];
    bolt.animate(frames,{duration:reduced?220:540,easing:'ease-out'});
    return true;
  }
  function remove(bolt) {
    if (!bolt) return;
    for (const animation of (bolt.getAnimations?.() || [])) animation.cancel();
    bolt.remove();
  }
  window.StarryBatteryCharge = Object.freeze({mount,flash,remove,version:'1.0.0'});
})();
