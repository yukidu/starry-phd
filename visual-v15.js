(() => {
  const style = document.createElement('style');
  style.textContent = `
    #starboost{position:fixed;inset:0;z-index:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}

    .earth>span::before{
      inset:0!important;width:auto!important;height:auto!important;left:0!important;top:0!important;
      opacity:.98!important;border-radius:50%!important;transform:none!important;box-shadow:none!important;
      background:
        radial-gradient(ellipse 13% 7% at 17% 16%,rgba(238,244,235,.9) 0 58%,transparent 66%),
        radial-gradient(ellipse 24% 18% at 27% 32%,#6fa45d 0 37%,#7f9657 48%,#756b48 58%,transparent 64%),
        radial-gradient(ellipse 10% 12% at 39% 42%,#729956 0 45%,#756d48 57%,transparent 64%),
        radial-gradient(ellipse 12% 26% at 42% 61%,#5d9855 0 38%,#70864e 51%,#76684a 60%,transparent 66%),
        radial-gradient(ellipse 12% 8% at 53% 31%,#6f9852 0 40%,#857752 54%,transparent 63%),
        radial-gradient(ellipse 24% 14% at 67% 31%,#79a35d 0 35%,#90845d 49%,#6a744e 58%,transparent 64%),
        radial-gradient(ellipse 12% 18% at 57% 53%,#739d55 0 39%,#8a7650 52%,#6c744c 60%,transparent 66%),
        radial-gradient(ellipse 14% 9% at 78% 66%,#708b50 0 40%,#8b7752 53%,transparent 62%),
        radial-gradient(ellipse 7% 5% at 84% 48%,#769c59 0 42%,transparent 64%),
        radial-gradient(ellipse 9% 4% at 58% 78%,rgba(238,243,236,.75) 0 53%,transparent 68%);
      filter:saturate(.88) contrast(1.06) brightness(.98)!important;
    }
    .earth>span::after{
      inset:1px!important;width:auto!important;height:auto!important;left:1px!important;top:1px!important;
      border:1px solid rgba(142,226,255,.35)!important;border-radius:50%!important;opacity:.72!important;
      background:
        radial-gradient(ellipse 37% 5% at 32% 25%,rgba(255,255,255,.64) 0 42%,rgba(255,255,255,.18) 55%,transparent 72%),
        radial-gradient(ellipse 31% 4% at 69% 38%,rgba(255,255,255,.58) 0 38%,rgba(255,255,255,.16) 57%,transparent 74%),
        radial-gradient(ellipse 36% 5% at 42% 63%,rgba(255,255,255,.48) 0 40%,rgba(255,255,255,.13) 58%,transparent 75%),
        radial-gradient(ellipse 23% 4% at 76% 73%,rgba(255,255,255,.42) 0 40%,transparent 72%);
      box-shadow:inset -9px -5px 13px rgba(0,18,61,.34),inset 6px 4px 10px rgba(156,230,255,.12),0 0 13px rgba(92,198,255,.58)!important;
      filter:blur(.2px)!important;mix-blend-mode:screen;transform:rotate(-8deg)!important;
    }

    .milky-way .galaxy-stars{position:absolute;inset:18% -7%;pointer-events:none;mix-blend-mode:screen;transform:translateZ(0)}
    .milky-way .galaxy-stars-a{opacity:.92;background:radial-gradient(circle,rgba(255,255,255,1) 0 1.15px,transparent 1.9px) 9px 18px/83px 71px,radial-gradient(circle,rgba(232,242,255,.94) 0 .9px,transparent 1.65px) 37px 11px/121px 97px,radial-gradient(circle,rgba(255,255,255,.88) 0 1px,transparent 1.8px) 3px 41px/149px 119px;filter:drop-shadow(0 0 5px rgba(220,238,255,.95));animation:galaxyTwinkleA 2.4s ease-in-out infinite alternate}
    .milky-way .galaxy-stars-b{opacity:.64;background:radial-gradient(circle,rgba(255,255,255,.92) 0 .72px,transparent 1.35px) 24px 8px/61px 53px,radial-gradient(circle,rgba(196,220,255,.82) 0 .62px,transparent 1.25px) 12px 29px/103px 87px,radial-gradient(circle,rgba(255,247,255,.78) 0 .75px,transparent 1.4px) 53px 44px/137px 101px;filter:drop-shadow(0 0 2px rgba(191,217,255,.72));animation:galaxyTwinkleB 4.1s ease-in-out infinite alternate-reverse}
    .milky-way .galaxy-stars-c{opacity:.4;background:radial-gradient(circle,rgba(255,255,255,.8) 0 .48px,transparent 1px) 5px 17px/43px 39px,radial-gradient(circle,rgba(183,207,255,.7) 0 .42px,transparent .95px) 31px 5px/71px 63px,radial-gradient(circle,rgba(255,255,255,.62) 0 .4px,transparent .9px) 19px 33px/89px 77px;filter:blur(.1px);animation:galaxyTwinkleC 6.8s ease-in-out infinite alternate}
    @keyframes galaxyTwinkleA{0%{opacity:.48;filter:drop-shadow(0 0 2px rgba(220,238,255,.5))}45%{opacity:1;filter:drop-shadow(0 0 7px rgba(237,247,255,1))}100%{opacity:.68;filter:drop-shadow(0 0 4px rgba(195,221,255,.75))}}
    @keyframes galaxyTwinkleB{0%{opacity:.34;transform:translate3d(-.4%,.2%,0)}55%{opacity:.78}100%{opacity:.5;transform:translate3d(.6%,-.35%,0)}}
    @keyframes galaxyTwinkleC{0%{opacity:.2}35%{opacity:.52}72%{opacity:.31}100%{opacity:.6}}

    /* M1 智慧手機效能模式：保留效果，只降低最昂貴的發光與模糊運算。 */
    html[data-starry-quality="medium"] .milky-way .galaxy-stars-a,
    html[data-starry-quality="medium"] .milky-way .galaxy-stars-b{filter:drop-shadow(0 0 2px rgba(210,232,255,.55))}
    html[data-starry-quality="medium"] .planet-wrap em.service-label{backdrop-filter:blur(4px)!important;-webkit-backdrop-filter:blur(4px)!important}
    html[data-starry-quality="low"] .milky-way{filter:none!important}
    html[data-starry-quality="low"] .milky-way .galaxy-stars-a,
    html[data-starry-quality="low"] .milky-way .galaxy-stars-b,
    html[data-starry-quality="low"] .milky-way .galaxy-stars-c{filter:none!important;animation-duration:9s!important}
    html[data-starry-quality="low"] .planet-wrap em.service-label{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  `;
  document.head.appendChild(style);

  const galaxy = document.querySelector('.milky-way');
  if (galaxy && !galaxy.querySelector('.galaxy-stars')) {
    ['a','b','c'].forEach((layer) => {
      const stars = document.createElement('span');
      stars.className = `galaxy-stars galaxy-stars-${layer}`;
      galaxy.appendChild(stars);
    });
  }

  const baseCanvas = document.querySelector('#starfield');
  if (!baseCanvas || document.querySelector('#starboost')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'starboost';
  canvas.setAttribute('aria-hidden', 'true');
  baseCanvas.insertAdjacentElement('afterend', canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 900px)').matches || navigator.maxTouchPoints > 1;
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  const QUALITY = ['low','medium','high'];
  let quality = 'desktop';
  if (mobile) {
    quality = reduceMotion ? 'low' : ((cores && cores <= 4) || (memory && memory <= 4) ? 'low' : 'medium');
  }

  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  let stars = [];
  let renderTick = 0;
  let sampleStart = performance.now();
  let sampleFrames = 0;
  let lowWindows = 0;
  let highWindows = 0;
  let lastQualityChange = 0;

  function qualityConfig() {
    if (!mobile) return { count: Math.max(520, Math.min(1050, Math.floor(width * height / 1500))), dpr: 2, skip: 0 };
    if (quality === 'high') return { count: 330, dpr: 1.5, skip: 0 };
    if (quality === 'medium') return { count: 220, dpr: 1.3, skip: 0 };
    return { count: reduceMotion ? 80 : 130, dpr: 1, skip: 1 };
  }

  function updateQualityMarker() {
    document.documentElement.dataset.starryQuality = mobile ? quality : 'desktop';
  }

  function makeStar(far = false) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), .64) * Math.max(width, height) * .94;
    const z = far ? width * (.72 + Math.random() * .28) : 14 + Math.random() * Math.max(width, 420);
    return { x:Math.cos(angle)*radius, y:Math.sin(angle)*radius, z, pz:z+2, speed:3.2+Math.random()*5.4, alpha:.28+Math.random()*.72, size:.32+Math.random()*1.05, cool:Math.random()>.78 };
  }

  function resetStar(star) { Object.assign(star, makeStar(true)); }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const cfg = qualityConfig();
    dpr = Math.min(devicePixelRatio || 1, cfg.dpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const areaScale = mobile ? Math.max(.8, Math.min(1.2, (width * height) / (390 * 844))) : 1;
    const target = mobile ? Math.max(70, Math.round(cfg.count * areaScale)) : cfg.count;
    if (stars.length > target) stars.length = target;
    while (stars.length < target) stars.push(makeStar());
  }

  function changeQuality(next) {
    if (!mobile || next === quality || !QUALITY.includes(next)) return;
    quality = next;
    lastQualityChange = performance.now();
    lowWindows = 0;
    highWindows = 0;
    updateQualityMarker();
    resize();
  }

  function measure(now) {
    if (!mobile || reduceMotion) return;
    sampleFrames += 1;
    const elapsed = now - sampleStart;
    if (elapsed < 2000) return;
    const fps = sampleFrames * 1000 / elapsed;
    sampleStart = now;
    sampleFrames = 0;
    if (now - lastQualityChange < 9000) return;

    if (fps < 47) {
      lowWindows += 1;
      highWindows = 0;
      if (lowWindows >= 2) {
        const index = QUALITY.indexOf(quality);
        if (index > 0) changeQuality(QUALITY[index - 1]);
      }
      return;
    }
    if (fps > 58) {
      highWindows += 1;
      lowWindows = 0;
      if (highWindows >= 6) {
        const index = QUALITY.indexOf(quality);
        if (index >= 0 && index < QUALITY.length - 1) changeQuality(QUALITY[index + 1]);
      }
      return;
    }
    lowWindows = 0;
    highWindows = 0;
  }

  function draw(now = performance.now()) {
    requestAnimationFrame(draw);
    if (document.hidden) return;
    measure(now);
    renderTick += 1;
    const cfg = qualityConfig();
    if (cfg.skip && renderTick % 2) return;

    ctx.clearRect(0,0,width,height);
    const cx = width * .5;
    const cy = height * .5;
    const projection = Math.max(width,520);
    for (const star of stars) {
      star.pz = star.z;
      if (!reduceMotion) star.z -= star.speed;
      if (star.z < 2) resetStar(star);
      const sx = (star.x / star.z) * projection + cx;
      const sy = (star.y / star.z) * projection + cy;
      const px = (star.x / star.pz) * projection + cx;
      const py = (star.y / star.pz) * projection + cy;
      if (sx < -140 || sx > width+140 || sy < -140 || sy > height+140) { resetStar(star); continue; }
      const near = Math.max(0,1-star.z/Math.max(width,420));
      const glow = Math.min(.96,star.alpha*(.35+near*.85));
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy);
      ctx.strokeStyle = star.cool ? `rgba(186,220,255,${glow})` : `rgba(255,255,255,${glow})`;
      ctx.lineWidth = Math.max(.28,star.size*(.38+near*1.3)); ctx.stroke();
      if (near>.72 && star.alpha>.72) {
        ctx.beginPath(); ctx.arc(sx,sy,Math.max(.35,star.size*.55),0,Math.PI*2);
        ctx.fillStyle=`rgba(255,255,255,${Math.min(.9,glow)})`; ctx.fill();
      }
    }
  }

  updateQualityMarker();
  addEventListener('resize', resize, { passive:true });
  document.addEventListener('visibilitychange', () => { sampleStart=performance.now(); sampleFrames=0; });
  resize();
  requestAnimationFrame(draw);
})();
