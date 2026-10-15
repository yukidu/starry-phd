(() => {
  const layer = document.querySelector('#meteorLayer');
  if (!layer) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 大隕石完全移除：即使舊版排程建立，也立刻刪掉，不顯示、不動畫。
  const style = document.createElement('style');
  style.textContent = '.space-rock.giant{display:none!important}';
  document.head.appendChild(style);

  const removeGiants = (root) => {
    if (!(root instanceof Element)) return;
    if (root.matches('.space-rock.giant')) root.remove();
    root.querySelectorAll?.('.space-rock.giant').forEach((el) => el.remove());
  };

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(removeGiants);
    }
  }).observe(layer, { childList: true, subtree: true });

  function spawnExtraSmallMeteor() {
    if (reduceMotion || document.hidden) return;

    const rock = document.createElement('span');
    rock.className = 'space-rock small';

    const width = innerWidth;
    const height = innerHeight;
    const size = 3 + Math.random() * 9;
    const tail = 72 + Math.random() * 145;
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -size * 2 : width + size * 2;
    const startY = height * (.04 + Math.random() * .86);
    const endX = fromLeft ? width + size * 2 : -size * 2;
    const endY = Math.max(-60, Math.min(height + 60, startY + (Math.random() - .5) * height * .62));
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const duration = 620 + Math.random() * 980;

    rock.style.left = `${startX}px`;
    rock.style.top = `${startY}px`;
    rock.style.setProperty('--rock-size', `${size}px`);
    rock.style.setProperty('--tail-size', `${tail}px`);
    rock.style.setProperty('--tail-thickness', `${.8 + Math.random() * 1.8}px`);
    rock.style.setProperty('--tail-angle', `${angle}rad`);
    layer.appendChild(rock);

    const anim = rock.animate([
      { transform: 'translate(-50%,-50%) translate3d(0,0,0) scale(.55)', opacity: 0 },
      { opacity: 1, offset: .1 },
      { transform: `translate(-50%,-50%) translate3d(${dx}px,${dy}px,0) scale(1)`, opacity: 0 }
    ], { duration, easing: 'linear', fill: 'forwards' });

    anim.onfinish = () => rock.remove();
  }

  if (!reduceMotion) {
    // 原本約每 0.9 秒 1 顆；額外加入密集小隕石，整體約提升到 3 倍以上。
    [120, 260, 430, 650].forEach((delay) => setTimeout(spawnExtraSmallMeteor, delay));
    setInterval(spawnExtraSmallMeteor, 420);
  }
})();
