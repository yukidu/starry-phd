(() => {
  // v30：快速連點保護。避免一般點擊火花、爆炸與獎勵提示同時堆疊造成手機畫面破碎。
  const style = document.createElement('style');
  style.textContent = `
    .click-burst,.click-burst *{display:none!important}
    .meteor-hit-explosion{contain:layout paint style}
  `;
  document.head.appendChild(style);

  // 舊版一般點擊會建立 12 條火花。快速連點時在低／中階手機會大量堆疊；直接在繪製前清掉。
  document.querySelectorAll('.click-burst').forEach((el) => el.remove());

  function keepLatest(selector, latest) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el !== latest) el.remove();
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches('.click-burst')) {
          node.remove();
          continue;
        }

        if (node.matches('.meteor-hit-explosion')) {
          keepLatest('.meteor-hit-explosion', node);
          continue;
        }

        if (node.matches('.battery-reward-instant')) {
          keepLatest('.battery-reward-instant', node);
        }

        node.querySelectorAll?.('.click-burst').forEach((el) => el.remove());
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
