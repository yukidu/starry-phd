(() => {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d', { alpha: true });
  const meteorLayer = document.getElementById('meteorLayer');
  const portalModal = document.getElementById('portalModal');
  const portalMessage = document.getElementById('portalMessage');
  const closeModal = document.getElementById('closeModal');
  const velocity = document.getElementById('velocity');
  const sector = document.getElementById('sector');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const phrases = [
    '量子航道準備中',
    '深空躍遷準備中',
    '星際方舟準備中',
    '文明奇點準備中',
    '曲速引擎準備中',
    '維度之門準備中',
    '時空折疊準備中',
    '引力航線準備中',
    '星門協議準備中',
    '光子航海準備中',
    '暗物質核心準備中',
    '宇宙信標準備中',
    '超空間港準備中',
    '銀河導航準備中',
    '高階文明頻道準備中',
    '天體工程準備中'
  ];

  const sectors = ['ORION-09', 'LYRA-27', 'NOVA-16', 'VEGA-81', 'ASTRA-03', 'KEPLER-22'];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(160, Math.min(480, Math.floor((width * height) / 4200)));
    stars = Array.from({ length: count }, makeStar);
  }

  function makeStar() {
    return {
      x: (Math.random() - 0.5) * width * 1.8,
      y: (Math.random() - 0.5) * height * 1.8,
      z: Math.random() * width + 1,
      pz: Math.random() * width + 1,
      hue: Math.random() > 0.87 ? (Math.random() > 0.5 ? 205 : 278) : 220,
      alpha: 0.35 + Math.random() * 0.65,
      size: 0.4 + Math.random() * 1.6
    };
  }

  function resetStar(star) {
    star.x = (Math.random() - 0.5) * width * 1.8;
    star.y = (Math.random() - 0.5) * height * 1.8;
    star.z = width;
    star.pz = width;
    star.alpha = 0.35 + Math.random() * 0.65;
    star.size = 0.4 + Math.random() * 1.6;
  }

  function drawStarfield() {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2 + pointerX * 18;
    const cy = height / 2 + pointerY * 12;
    const speed = reduceMotion ? 0 : Math.max(2.5, width / 310);

    for (const star of stars) {
      star.pz = star.z;
      star.z -= speed;
      if (star.z < 1) resetStar(star);

      const sx = (star.x / star.z) * width + cx;
      const sy = (star.y / star.z) * width + cy;
      const px = (star.x / star.pz) * width + cx;
      const py = (star.y / star.pz) * width + cy;

      if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) {
        resetStar(star);
        continue;
      }

      const proximity = 1 - star.z / width;
      const lineWidth = Math.max(0.35, star.size * proximity * 1.15);
      const light = 76 + proximity * 22;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = `hsla(${star.hue}, 100%, ${light}%, ${Math.min(0.9, star.alpha * (0.32 + proximity))})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      if (proximity > 0.76) {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.45, lineWidth * 0.8), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha * 0.72})`;
        ctx.fill();
      }
    }

    frame += 1;
    if (frame % 190 === 0) {
      velocity.textContent = `${(7.8 + Math.random() * 2.4).toFixed(1)}c`;
    }
    requestAnimationFrame(drawStarfield);
  }

  function spawnMeteor() {
    if (reduceMotion || document.hidden) return;
    const meteor = document.createElement('span');
    meteor.className = 'meteor';
    meteor.style.left = `${58 + Math.random() * 42}%`;
    meteor.style.top = `${Math.random() * 42}%`;
    meteor.style.animationDuration = `${0.8 + Math.random() * 0.8}s`;
    meteorLayer.appendChild(meteor);
    meteor.addEventListener('animationend', () => meteor.remove(), { once: true });
  }

  function openPortal(button) {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    portalMessage.textContent = phrase;
    button.classList.remove('flash');
    void button.offsetWidth;
    button.classList.add('flash');

    if (!reduceMotion && 'vibrate' in navigator) {
      navigator.vibrate?.(18);
    }

    window.setTimeout(() => {
      portalModal.classList.add('open');
      portalModal.setAttribute('aria-hidden', 'false');
      closeModal.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 180);
  }

  function closePortal() {
    portalModal.classList.remove('open');
    portalModal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('.portal-btn').forEach((button) => {
    button.addEventListener('click', () => openPortal(button));
  });

  closeModal.addEventListener('click', closePortal);
  portalModal.addEventListener('click', (event) => {
    if (event.target === portalModal) closePortal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePortal();
  });

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX / Math.max(1, width) - 0.5;
    pointerY = event.clientY / Math.max(1, height) - 0.5;
  }, { passive: true });

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sector.textContent = sectors[Math.floor(Math.random() * sectors.length)];
  });

  resize();
  drawStarfield();
  if (!reduceMotion) {
    window.setInterval(spawnMeteor, 1700);
    window.setInterval(() => {
      sector.textContent = sectors[Math.floor(Math.random() * sectors.length)];
    }, 7200);
  }
})();
