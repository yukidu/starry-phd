(() => {
  // v33-card-only-navigation
  // 只有星球下方服務卡片可開啟 App；點星球本體、星球名稱或卡片外空白都不跳轉。
  let press = null;

  function getCardTarget(target) {
    if (!(target instanceof Element)) return null;
    const label = target.closest('.service-label');
    const card = target.closest('.planet-wrap[data-url]');
    if (!label || !card || label.closest('.planet-wrap[data-url]') !== card) return null;
    return { label, card };
  }

  document.querySelectorAll('.planet-wrap[data-url]').forEach((card) => {
    const label = card.querySelector('.service-label');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
    card.style.cursor = 'default';

    if (!label) return;
    const name = card.querySelector('.service-name')?.textContent?.trim() || 'Starry App';
    const host = card.querySelector('.service-host')?.textContent?.trim() || '';
    label.setAttribute('role', 'link');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-label', host ? `${name}，在新視窗開啟 ${host}` : name);
    label.style.cursor = 'pointer';

    label.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      const url = card.dataset.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

  document.addEventListener('pointerdown', (event) => {
    const target = getCardTarget(event.target);
    if (!target || (event.button != null && event.button !== 0)) {
      press = null;
      return;
    }

    press = {
      card: target.card,
      label: target.label,
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
    if (!(event.target instanceof Element) || !current.label.contains(event.target)) return;
    const url = current.card?.dataset?.url;
    if (!url) return;

    current.card.dataset.v33OpenedAt = String(performance.now());
    window.open(url, '_blank', 'noopener,noreferrer');
  }, true);

  document.addEventListener('pointercancel', () => {
    press = null;
  }, true);

  // 攔截原始 planet-wrap 點擊：卡片外一律不導頁；卡片已在 pointerup 開啟時阻止重複開分頁。
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest('.planet-wrap[data-url]');
    if (!card) return;

    const label = event.target.closest('.service-label');
    const isServiceCard = !!label && label.closest('.planet-wrap[data-url]') === card;
    const openedAt = Number(card.dataset.v33OpenedAt || 0);

    if (!isServiceCard || performance.now() - openedAt < 800) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // Tablet / large-screen readability: make service-card text substantially larger.
  const style = document.createElement('style');
  style.textContent = `
    .planet-wrap[data-url] { cursor: default !important; }
    .planet-wrap[data-url] em.service-label { cursor: pointer !important; }

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