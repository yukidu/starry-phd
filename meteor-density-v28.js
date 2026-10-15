(() => {
  // v28：所有小隕石統一只保留一半，畫面數量降低 50%。
  const layer = document.querySelector('#meteorLayer');
  if (!layer) return;

  let sequence = 0;

  function applyDensity(rock) {
    if (!(rock instanceof HTMLElement) || !rock.matches('.space-rock.small')) return;
    if (rock.dataset.v28DensityChecked === '1') return;
    rock.dataset.v28DensityChecked = '1';
    sequence += 1;

    if (sequence % 2 === 0) {
      rock.getAnimations().forEach((animation) => animation.cancel());
      rock.remove();
    }
  }

  layer.querySelectorAll('.space-rock.small').forEach(applyDensity);

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        applyDensity(node);
        node.querySelectorAll?.('.space-rock.small').forEach(applyDensity);
      }
    }
  }).observe(layer, { childList:true, subtree:true });
})();
