(() => {
  // Fix desktop planet-card clicks while preserving drag-to-look behavior.
  let press = null;

  document.addEventListener('pointerdown', (event) => {
    const card = event.target instanceof Element
      ? event.target.closest('.planet-wrap[data-url]')
      : null;

    if (!card || (event.button != null && event.button !== 0)) {
      press = null;
      return;
    }

    press = {
      card,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      travel: 0
    };
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    press.travel += Math.abs(event.clientX - press.lastX) + Math.abs(event.clientY - press.lastY);
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  }, true);

  document.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;

    const current = press;
    press = null;

    if (current.travel > 12) return;
    const url = current.card?.dataset?.url;
    if (!url) return;

    current.card.dataset.v16OpenedAt = String(performance.now());
    window.open(url, '_blank', 'noopener,noreferrer');
  }, true);

  document.addEventListener('pointercancel', () => {
    press = null;
  }, true);

  // Prevent the legacy click handler from opening a duplicate tab after the pointerup fix.
  document.addEventListener('click', (event) => {
    const card = event.target instanceof Element
      ? event.target.closest('.planet-wrap[data-url]')
      : null;
    if (!card) return;

    const openedAt = Number(card.dataset.v16OpenedAt || 0);
    if (performance.now() - openedAt < 800) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Tablet / large-screen readability: make service-card text substantially larger.
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: 768px) {
      .planet-wrap em.service-label {
        min-width: 210px !important;
        padding: 12px 16px 14px !important;
        border-radius: 14px !important;
      }
      .planet-wrap .service-name {
        font-size: 22px !important;
        line-height: 1.22 !important;
      }
      .planet-wrap .service-host {
        margin-top: 7px !important;
        font-size: 14px !important;
        line-height: 1.1 !important;
        letter-spacing: .06em !important;
      }
      .planet-wrap .celestial-name {
        font-size: 11px !important;
      }
      .p5 em.service-label { margin-top: 36px !important; }
      .p6 em.service-label { margin-top: 31px !important; }
    }

    @media (min-width: 1200px) {
      .planet-wrap em.service-label {
        min-width: 245px !important;
        padding: 15px 20px 17px !important;
        border-radius: 16px !important;
      }
      .planet-wrap .service-name {
        font-size: 29px !important;
        line-height: 1.18 !important;
      }
      .planet-wrap .service-host {
        margin-top: 8px !important;
        font-size: 17px !important;
      }
      .planet-wrap .celestial-name {
        font-size: 13px !important;
      }
      .p5 em.service-label { margin-top: 42px !important; }
      .p6 em.service-label { margin-top: 36px !important; }
    }
  `;
  document.head.appendChild(style);
})();
