(() => {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d', { alpha: true });
  const meteorLayer = document.getElementById('meteorLayer');
  const portalModal = document.getElementById('portalModal');
  const portalMessage = document.getElementById('portalMessage');
  const closeModal = document.getElementById('closeModal');
  const velocity = document.getElementById('velocity');
  const sector = document.getElementById('sector');
  const universe = document.querySelector('.universe');
  const nebulaA = document.querySelector('.nebula-a');
  const nebulaB = document.querySelector('.nebula-b');
  const planets = Array.from(document.querySelectorAll('.planet-wrap'));
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
  const depth = [0.62, 0.82, 1.22, 0.96, 1.62, 1.42, 0.76, 1.08, 0.52];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let frame = 0;
  let mouseX = 0;
  let mouseY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let viewX = 0;
  let viewY = 0;
  let motionAttached = false;
  let motionActive = false;
  let calibration = null;

  let audioContext = null;
  let masterGain = null;
  let audioEnabled = false;
  let audioBuilt = false;
  let chimeTimer = null;

  const immersiveStyle = document.createElement('style');
  immersiveStyle.textContent = `
    .universe {
      will-change: transform;
      transform-origin: 50% 50%;
      transition: transform .08s linear;
    }
    .planet-wrap {
      will-change: translate, transform;
      transition: translate .09s linear;
    }
    .planet > span {
      animation-name: planetSpin !important;
      animation-timing-function: linear !important;
      animation-iteration-count: infinite !important;
    }
    .planet-wrap:nth-child(1) .planet > span { animation-duration: 9s !important; }
    .planet-wrap:nth-child(2) .planet > span { animation-duration: 14s !important; animation-direction: reverse; }
    .planet-wrap:nth-child(3) .planet > span { animation-duration: 18s !important; }
    .planet-wrap:nth-child(4) .planet > span { animation-duration: 12s !important; animation-direction: reverse; }
    .planet-wrap:nth-child(5) .planet > span { animation-duration: 11s !important; }
    .planet-wrap:nth-child(6) .planet > span { animation-duration: 16s !important; }
    .planet-wrap:nth-child(7) .planet > span { animation-duration: 13s !important; animation-direction: reverse; }
    .planet-wrap:nth-child(8) .planet > span { animation-duration: 15s !important; }
    .planet-wrap:nth-child(9) .planet > span { animation-duration: 10s !important; animation-direction: reverse; }

    .store-zone {
      position: fixed !important;
      left: 50% !important;
      bottom: max(18px, env(safe-area-inset-bottom)) !important;
      transform: translateX(-50%) !important;
      z-index: 24 !important;
      width: min(560px, calc(100vw - 28px)) !important;
      margin: 0 !important;
      display: flex !important;
      flex-direction: row !important;
      justify-content: center !important;
      gap: 10px !important;
      animation: none !important;
    }
    .store-zone .portal-btn {
      flex: 1 1 0 !important;
      min-width: 0 !important;
      height: 58px !important;
    }
    .status-pill {
      bottom: calc(max(18px, env(safe-area-inset-bottom)) + 70px) !important;
    }
    .hero {
      padding-bottom: max(142px, 20vh) !important;
    }

    #immersiveToggle {
      position: fixed;
      z-index: 26;
      top: max(14px, env(safe-area-inset-top));
      right: max(14px, env(safe-area-inset-right));
      min-height: 38px;
      padding: 0 13px;
      border: 1px solid rgba(160, 223, 255, .22);
      border-radius: 999px;
      color: rgba(229, 247, 255, .82);
      background: rgba(5, 11, 28, .48);
      box-shadow: inset 0 0 18px rgba(125, 249, 255, .04), 0 8px 30px rgba(0, 0, 0, .22);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font: 600 10px/1 "Noto Sans TC", system-ui, sans-serif;
      letter-spacing: .09em;
      cursor: pointer;
      transition: .25s ease;
    }
    #immersiveToggle:hover,
    #immersiveToggle.active {
      border-color: rgba(125, 249, 255, .5);
      color: #eaffff;
      box-shadow: 0 0 18px rgba(75, 175, 255, .15), inset 0 0 20px rgba(125, 249, 255, .07);
    }
    #immersiveToggle.pulse {
      animation: immersivePulse 2.2s ease-in-out infinite;
    }
    @keyframes immersivePulse {
      50% { box-shadow: 0 0 24px rgba(125, 249, 255, .22), inset 0 0 20px rgba(125, 249, 255, .07); }
    }

    @media (max-width: 760px) {
      .store-zone {
        width: calc(100vw - 18px) !important;
        gap: 7px !important;
        bottom: max(10px, env(safe-area-inset-bottom)) !important;
      }
      .store-zone .portal-btn {
        height: 54px !important;
        padding: 0 10px !important;
        gap: 8px !important;
        border-radius: 14px !important;
      }
      .store-zone .portal-icon {
        width: 30px !important;
        height: 30px !important;
        flex-basis: 30px !important;
      }
      .store-zone .portal-copy small {
        display: none !important;
      }
      .store-zone .portal-copy strong {
        font-size: 11px !important;
        white-space: nowrap;
      }
      .status-pill {
        bottom: calc(max(10px, env(safe-area-inset-bottom)) + 64px) !important;
        max-width: 74vw !important;
      }
      #immersiveToggle {
        top: max(10px, env(safe-area-inset-top));
        right: max(10px, env(safe-area-inset-right));
        min-height: 34px;
        padding: 0 10px;
        font-size: 9px;
      }
      .hero {
        padding-bottom: max(128px, 18vh) !important;
      }
    }

    @media (max-height: 620px) and (orientation: landscape) {
      .store-zone {
        bottom: max(8px, env(safe-area-inset-bottom)) !important;
        width: min(500px, calc(100vw - 120px)) !important;
      }
      .store-zone .portal-btn {
        height: 46px !important;
      }
      #immersiveToggle {
        top: 8px;
        right: max(10px, env(safe-area-inset-right));
      }
    }
  `;
  document.head.appendChild(immersiveStyle);

  const immersiveToggle = document.createElement('button');
  immersiveToggle.id = 'immersiveToggle';
  immersiveToggle.type = 'button';
  immersiveToggle.className = 'pulse';
  immersiveToggle.textContent = '✦ 啟動沉浸模式';
  immersiveToggle.setAttribute('aria-pressed', 'false');
  immersiveToggle.setAttribute('aria-label', '啟動宇宙背景音樂與手機傾斜景深');
  document.body.appendChild(immersiveToggle);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

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

  function applyParallax() {
    const targetX = motionActive ? tiltX : mouseX;
    const targetY = motionActive ? tiltY : mouseY;
    const ease = reduceMotion ? 0.025 : 0.07;

    viewX += (targetX - viewX) * ease;
    viewY += (targetY - viewY) * ease;

    if (universe) {
      const tx = viewX * 22;
      const ty = viewY * 15;
      universe.style.transform =
        `translate3d(${tx}px, ${ty}px, 0) rotateY(${-viewX * 4.5}deg) rotateX(${viewY * 3.2}deg) scale(1.08)`;
    }

    if (nebulaA) nebulaA.style.translate = `${-viewX * 14}px ${-viewY * 9}px`;
    if (nebulaB) nebulaB.style.translate = `${viewX * 11}px ${viewY * 8}px`;
    if (meteorLayer) meteorLayer.style.translate = `${-viewX * 5}px ${-viewY * 4}px`;

    planets.forEach((planet, index) => {
      const factor = depth[index] || 1;
      planet.style.translate = `${viewX * 24 * factor}px ${viewY * 17 * factor}px`;
    });
  }

  function drawStarfield() {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2 + viewX * 32;
    const cy = height / 2 + viewY * 22;
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

    applyParallax();

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

  function getScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    return typeof window.orientation === 'number' ? window.orientation : 0;
  }

  function handleOrientation(event) {
    if (event.beta == null || event.gamma == null) return;

    if (!calibration) {
      calibration = { beta: event.beta, gamma: event.gamma };
      return;
    }

    const db = clamp(event.beta - calibration.beta, -24, 24);
    const dg = clamp(event.gamma - calibration.gamma, -24, 24);
    const angle = ((getScreenAngle() % 360) + 360) % 360;

    if (angle === 90) {
      tiltX = clamp(db / 20, -1, 1);
      tiltY = clamp(-dg / 20, -1, 1);
    } else if (angle === 270) {
      tiltX = clamp(-db / 20, -1, 1);
      tiltY = clamp(dg / 20, -1, 1);
    } else {
      tiltX = clamp(dg / 20, -1, 1);
      tiltY = clamp(db / 20, -1, 1);
    }

    motionActive = true;
  }

  function attachMotion() {
    if (motionAttached || !('DeviceOrientationEvent' in window)) return;
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    motionAttached = true;
  }

  function resetCalibration() {
    calibration = null;
    tiltX = 0;
    tiltY = 0;
  }

  function enableMotion() {
    if (!('DeviceOrientationEvent' in window)) return Promise.resolve(false);

    const DeviceOrientation = window.DeviceOrientationEvent;
    if (typeof DeviceOrientation.requestPermission === 'function') {
      return DeviceOrientation.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            attachMotion();
            resetCalibration();
            return true;
          }
          return false;
        })
        .catch(() => false);
    }

    attachMotion();
    resetCalibration();
    return Promise.resolve(true);
  }

  function createAudioGraph() {
    if (audioBuilt) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1450;
    lowpass.Q.value = 0.7;

    const delay = audioContext.createDelay(1.5);
    delay.delayTime.value = 0.46;
    const feedback = audioContext.createGain();
    feedback.gain.value = 0.22;
    delay.connect(feedback);
    feedback.connect(delay);

    lowpass.connect(masterGain);
    lowpass.connect(delay);
    delay.connect(masterGain);
    masterGain.connect(audioContext.destination);

    const droneNotes = [55, 82.41, 110, 164.81];
    droneNotes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index % 2 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 ? 4 : -3;
      gain.gain.value = index < 2 ? 0.032 : 0.016;
      oscillator.connect(gain);
      gain.connect(lowpass);
      oscillator.start();
    });

    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 360;
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);
    lfo.start();

    audioBuilt = true;
  }

  function playChime() {
    if (!audioEnabled || !audioContext || document.hidden) return;

    const notes = [220, 277.18, 329.63, 440, 493.88, 659.25];
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const panner = typeof audioContext.createStereoPanner === 'function'
      ? audioContext.createStereoPanner()
      : null;

    oscillator.type = 'sine';
    oscillator.frequency.value = notes[Math.floor(Math.random() * notes.length)];
    oscillator.detune.value = (Math.random() - 0.5) * 12;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.036, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

    if (panner) {
      panner.pan.value = Math.random() * 1.4 - 0.7;
      oscillator.connect(gain);
      gain.connect(panner);
      panner.connect(masterGain);
    } else {
      oscillator.connect(gain);
      gain.connect(masterGain);
    }

    oscillator.start(now);
    oscillator.stop(now + 4.4);
  }

  function scheduleChime() {
    window.clearTimeout(chimeTimer);
    if (!audioEnabled) return;

    chimeTimer = window.setTimeout(() => {
      playChime();
      scheduleChime();
    }, 3600 + Math.random() * 4200);
  }

  function setAudioEnabled(enabled) {
    createAudioGraph();
    if (!audioContext || !masterGain) return;

    audioEnabled = enabled;
    const now = audioContext.currentTime;
    audioContext.resume().catch(() => {});
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
    masterGain.gain.exponentialRampToValueAtTime(enabled ? 0.075 : 0.0001, now + 1.1);

    if (enabled) {
      playChime();
      scheduleChime();
    } else {
      window.clearTimeout(chimeTimer);
    }

    immersiveToggle.classList.toggle('active', enabled);
    immersiveToggle.classList.remove('pulse');
    immersiveToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    immersiveToggle.textContent = enabled ? '♫ 宇宙音場 ON' : '♫ 宇宙音場 OFF';
  }

  function startAudioFromGesture() {
    if (audioEnabled) return;
    setAudioEnabled(true);
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
    mouseX = clamp((event.clientX / Math.max(1, width) - 0.5) * 2, -1, 1);
    mouseY = clamp((event.clientY / Math.max(1, height) - 0.5) * 2, -1, 1);
  }, { passive: true });

  immersiveToggle.addEventListener('click', () => {
    const shouldEnable = !audioEnabled;
    if (shouldEnable) {
      startAudioFromGesture();
      enableMotion().then((granted) => {
        immersiveToggle.title = granted
          ? '宇宙音場與手機傾斜景深已啟動'
          : '宇宙音場已啟動；此裝置未提供傾斜感應權限';
      });
    } else {
      setAudioEnabled(false);
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target === immersiveToggle || immersiveToggle.contains(event.target)) return;
    startAudioFromGesture();
  }, { once: true, passive: true });

  if ('DeviceOrientationEvent' in window &&
      typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
    attachMotion();
  }

  window.addEventListener('orientationchange', resetCalibration, { passive: true });
  if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
    screen.orientation.addEventListener('change', resetCalibration);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      sector.textContent = sectors[Math.floor(Math.random() * sectors.length)];
      if (audioEnabled && audioContext) {
        audioContext.resume().catch(() => {});
        scheduleChime();
      }
    } else if (audioContext) {
      window.clearTimeout(chimeTimer);
      audioContext.suspend().catch(() => {});
    }
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
