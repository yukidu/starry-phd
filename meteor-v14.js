(() => {
  const layer = document.querySelector('#meteorLayer');
  if (!layer) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let meteorAudioContext = null;

  const style = document.createElement('style');
  style.textContent = `
    .space-rock.giant{display:none!important}
    .space-rock.small[data-interactive-meteor="1"]{
      pointer-events:auto!important;
      cursor:crosshair;
      touch-action:manipulation;
      min-width:18px;
      min-height:18px;
      filter:drop-shadow(0 0 6px rgba(255,176,92,.42));
    }
    .meteor-hit-explosion{
      position:fixed;
      z-index:80;
      width:24px;
      height:24px;
      border-radius:50%;
      pointer-events:none;
      transform:translate(-50%,-50%);
      background:radial-gradient(circle,#fff 0 16%,#ffe4a3 17% 30%,#ff8a2c 31% 48%,rgba(255,55,20,.55) 49% 64%,transparent 65%);
      box-shadow:0 0 20px 7px rgba(255,209,118,.95),0 0 54px 22px rgba(255,93,30,.62),0 0 110px 34px rgba(255,35,15,.24);
      animation:meteorExplosionCore .72s cubic-bezier(.14,.82,.2,1) forwards;
    }
    .meteor-hit-explosion::before,
    .meteor-hit-explosion::after{
      content:"";
      position:absolute;
      left:50%;
      top:50%;
      width:32px;
      height:32px;
      border-radius:50%;
      border:2px solid rgba(255,224,155,.95);
      transform:translate(-50%,-50%) scale(.35);
      animation:meteorExplosionRing .72s ease-out forwards;
    }
    .meteor-hit-explosion::after{
      border-color:rgba(255,112,52,.76);
      animation-delay:.06s;
    }
    .meteor-hit-shard{
      position:absolute;
      left:50%;
      top:50%;
      width:4px;
      height:24px;
      border-radius:999px;
      background:linear-gradient(#fff8cf,#ff9b37 42%,rgba(255,70,25,.45) 68%,transparent);
      transform-origin:50% 0;
      filter:drop-shadow(0 0 5px rgba(255,170,74,.95));
      animation:meteorExplosionShard .68s ease-out forwards;
    }
    @keyframes meteorExplosionCore{
      0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}
      34%{opacity:1;transform:translate(-50%,-50%) scale(2.5)}
      100%{opacity:0;transform:translate(-50%,-50%) scale(4.1)}
    }
    @keyframes meteorExplosionRing{
      0%{opacity:1;transform:translate(-50%,-50%) scale(.25)}
      100%{opacity:0;transform:translate(-50%,-50%) scale(5.3)}
    }
    @keyframes meteorExplosionShard{
      0%{opacity:1;transform:rotate(var(--shard-angle)) translateY(0) scaleY(.65)}
      100%{opacity:0;transform:rotate(var(--shard-angle)) translateY(var(--shard-distance)) scaleY(.15)}
    }
  `;
  document.head.appendChild(style);

  function removeGiants(root) {
    if (!(root instanceof Element)) return;
    if (root.matches('.space-rock.giant')) root.remove();
    root.querySelectorAll?.('.space-rock.giant').forEach((el) => el.remove());
  }

  function randomTapFriendlyDuration() {
    const r = Math.random();
    if (r < .28) return 4000 + Math.random() * 1400;
    if (r < .72) return 5800 + Math.random() * 2400;
    return 9000 + Math.random() * 4000;
  }

  function ensureMeteorAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!meteorAudioContext) meteorAudioContext = new AC();
    if (meteorAudioContext.state === 'suspended') meteorAudioContext.resume().catch(() => {});
    return meteorAudioContext;
  }

  function playExplosionSound() {
    const ac = ensureMeteorAudio();
    if (!ac) return;

    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(.0001, now);
    master.gain.exponentialRampToValueAtTime(.72, now + .008);
    master.gain.exponentialRampToValueAtTime(.0001, now + .62);
    master.connect(ac.destination);

    const boom = ac.createOscillator();
    const boomGain = ac.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(105, now);
    boom.frequency.exponentialRampToValueAtTime(38, now + .52);
    boomGain.gain.setValueAtTime(.56, now);
    boomGain.gain.exponentialRampToValueAtTime(.0001, now + .58);
    boom.connect(boomGain);
    boomGain.connect(master);
    boom.start(now);
    boom.stop(now + .62);

    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * .5), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const decay = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const noise = ac.createBufferSource();
    const noiseFilter = ac.createBiquadFilter();
    const noiseGain = ac.createGain();
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1250, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(420, now + .42);
    noiseFilter.Q.value = .55;
    noiseGain.gain.setValueAtTime(.46, now);
    noiseGain.gain.exponentialRampToValueAtTime(.0001, now + .46);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + .5);
  }

  function createExplosion(x, y) {
    const burst = document.createElement('span');
    burst.className = 'meteor-hit-explosion';
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;

    for (let i = 0; i < 18; i++) {
      const shard = document.createElement('i');
      shard.className = 'meteor-hit-shard';
      shard.style.setProperty('--shard-angle', `${i * 20 + (Math.random() * 10 - 5)}deg`);
      shard.style.setProperty('--shard-distance', `${38 + Math.random() * 46}px`);
      burst.appendChild(shard);
    }

    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 850);
  }

  function explodeMeteor(rock, event) {
    if (!rock.isConnected || rock.dataset.exploded === '1') return;
    rock.dataset.exploded = '1';

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const rect = rock.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    rock.getAnimations().forEach((anim) => anim.cancel());
    rock.remove();
    createExplosion(x, y);
    playExplosionSound();
    navigator.vibrate?.([18, 22, 30]);

    window.dispatchEvent(new CustomEvent('starry:meteor-blasted', {
      detail: { rock, x, y }
    }));
  }

  function enhanceMeteor(rock) {
    if (!(rock instanceof HTMLElement)) return;
    if (!rock.matches('.space-rock.small')) return;
    if (rock.dataset.interactiveMeteor === '1') return;

    rock.dataset.interactiveMeteor = '1';
    const originalSize = Number.parseFloat(rock.style.getPropertyValue('--rock-size'));
    const visualSize = originalSize >= 18 && originalSize <= 36 ? originalSize : 18 + Math.random() * 18;
    rock.style.setProperty('--rock-size', `${visualSize}px`);
    const tier = window.starryMeteorRewardTier?.(visualSize);
    if(tier){ rock.dataset.batterySizeLevel=String(tier.level); rock.dataset.batteryRewardHundredths=String(tier.hundredths); }
    rock.style.setProperty('--tail-size', `${105 + Math.random() * 150}px`);
    rock.style.setProperty('--tail-thickness', `${1.8 + Math.random() * 2.5}px`);
    rock.style.pointerEvents = 'auto';

    queueMicrotask(() => {
      const duration = randomTapFriendlyDuration();
      rock.getAnimations().forEach((anim) => {
        try {
          anim.effect?.updateTiming?.({ duration });
        } catch {}
      });
    });

    rock.addEventListener('pointerdown', (event) => explodeMeteor(rock, event), { once: true });
  }

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        removeGiants(node);
        if (node instanceof HTMLElement) {
          if (node.matches('.space-rock.small')) enhanceMeteor(node);
          node.querySelectorAll?.('.space-rock.small').forEach(enhanceMeteor);
        }
      });
    }
  }).observe(layer, { childList: true, subtree: true });

  layer.querySelectorAll('.space-rock.small').forEach(enhanceMeteor);

  function spawnExtraSmallMeteor() {
    if (reduceMotion || document.hidden) return;
    if (window.starryPerformance?.allowMeteor && !window.starryPerformance.allowMeteor('extra')) return;

    const rock = document.createElement('span');
    rock.className = 'space-rock small';

    const width = innerWidth;
    const height = innerHeight;
    const size = 18 + Math.random() * 18;
    const tail = 105 + Math.random() * 150;
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -size * 2 : width + size * 2;
    const startY = height * (.05 + Math.random() * .84);
    const endX = fromLeft ? width + size * 2 : -size * 2;
    const endY = Math.max(-70, Math.min(height + 70, startY + (Math.random() - .5) * height * .58));
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const duration = randomTapFriendlyDuration();

    rock.style.left = `${startX}px`;
    rock.style.top = `${startY}px`;
    rock.style.setProperty('--rock-size', `${size}px`);
    rock.style.setProperty('--tail-size', `${tail}px`);
    rock.style.setProperty('--tail-thickness', `${1.8 + Math.random() * 2.5}px`);
    rock.style.setProperty('--tail-angle', `${angle}rad`);
    layer.appendChild(rock);

    const anim = rock.animate([
      { transform: 'translate(-50%,-50%) translate3d(0,0,0) scale(.72)', opacity: 0 },
      { opacity: 1, offset: .08 },
      { transform: `translate(-50%,-50%) translate3d(${dx}px,${dy}px,0) scale(1)`, opacity: 0 }
    ], { duration, easing: 'linear', fill: 'forwards' });

    anim.onfinish = () => rock.remove();
  }

  if (!reduceMotion) {
    [260, 860].forEach((delay) => setTimeout(spawnExtraSmallMeteor, delay));
    setInterval(spawnExtraSmallMeteor, 1400);
  }
})();
