(() => {
  // v31：恢復任意位置點擊特效與既有音效；同時限制特效堆疊，避免快速連點造成畫面破碎。
  const style = document.createElement('style');
  style.textContent = `
    .click-burst{contain:layout paint style}
    .meteor-hit-explosion{contain:layout paint style}
  `;
  document.head.appendChild(style);

  function limitEffects(selector, maxCount) {
    const items = Array.from(document.querySelectorAll(selector));
    const extra = items.length - maxCount;
    if (extra <= 0) return;
    items.slice(0, extra).forEach((el) => el.remove());
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches('.click-burst')) {
          // 保留最多兩個一般點擊特效；音效仍由原本 clickFx 即時播放。
          limitEffects('.click-burst', 2);
          continue;
        }

        if (node.matches('.meteor-hit-explosion')) {
          // 隕石爆炸只保留最新一個，避免大面積爆炸光效重疊。
          limitEffects('.meteor-hit-explosion', 1);
          continue;
        }

        if (node.matches('.battery-reward-instant')) {
          // 電池獎勵提示只保留最新一個。
          limitEffects('.battery-reward-instant', 1);
          continue;
        }

        node.querySelectorAll?.('.click-burst').forEach(() => limitEffects('.click-burst', 2));
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
