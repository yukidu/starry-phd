(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#starfield');
  const ctx = canvas.getContext('2d', { alpha: true });
  const meteorLayer = $('#meteorLayer');
  const portalModal = $('#portalModal');
  const portalMessage = $('#portalMessage');
  const closeModal = $('#closeModal');
  const velocity = $('#velocity');
  const sector = $('#sector');
  const hint = $('#freeLookHint');
  const nebulaA = $('.nebula-a');
  const nebulaB = $('.nebula-b');
  const planets = Array.from(document.querySelectorAll('.planet-wrap'));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const phrases = [
    '量子航道準備中','深空躍遷準備中','星際方舟準備中','文明奇點準備中',
    '曲速引擎準備中','維度之門準備中','時空折疊準備中','引力航線準備中',
    '星門協議準備中','光子航海準備中','暗物質核心準備中','宇宙信標準備中',
    '超空間港準備中','銀河導航準備中','高階文明頻道準備中','天體工程準備中'
  ];
  const sectors = ['ORION-09','LYRA-27','NOVA-16','VEGA-81','ASTRA-03','KEPLER-22'];
  const planetMap = [
    // Earth = 1.00x. Every planet stays between 1/1.2 and 1.2 Earth.
    { yaw: 0, pitch: -23, size: .88 },
    { yaw: 40, pitch: 23, size: .96 },
    { yaw: 80, pitch: 0, size: 1 },
    { yaw: 120, pitch: -23, size: .92 },
    { yaw: 160, pitch: 0, size: 1.13 },
    { yaw: 200, pitch: 23, size: 1.07 },
    { yaw: 240, pitch: -23, size: .90 },
    { yaw: 280, pitch: 0, size: 1.04 },
    { yaw: 320, pitch: 23, size: .88 } // Sun is a separate giant background, not a planet.
  ];
  const spinDurations = [9,14,18,12,11,16,13,15,10];

  let width = innerWidth, height = innerHeight, dpr = 1, stars = [], frame = 0;
  // Earth (index 2, 80°) is the landing viewpoint on every new entry.
  let cameraYaw = 80, autoYaw = 0, tiltYaw = 0;
  let dragging = false, pointerId = null, lastX = 0, lastY = 0, totalMove = 0;
  let dragStartedOnServiceLink = false, dragCaptured = false;
  let yawVelocity = 0, inertiaId = 0, inertiaActive = false;
  let motionAttached = false, calibration = null, motionPermissionAttempted = false;
  let targetTiltYaw = 0;
  let displayedYaw = 80, displayedPitch = 0, lastFrameAt = 0;
  let planetSizes = null, maxPlanetGroupHeight = 0, protectedHeaderBottom = 0;
  let lastPrimaryDraw = 0, lastRenderedPlanetYaw = NaN;
  let audioContext = null, musicGain = null, fxGain = null, musicOn = false, melodyTimer = 0, melodyStep = 0;
  let suppressPlanetOpenUntil = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const normAngle = (a) => ((a + 540) % 360) - 180;
  const rad = (d) => d * Math.PI / 180;

  planets.forEach((wrap, i) => {
    wrap.style.left = '0';
    wrap.style.top = '0';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
    const span = wrap.querySelector('.planet > span');
    if (span) {
      span.style.animationDuration = `${spinDurations[i] || 14}s`;
      span.style.animationTimingFunction = 'linear';
      span.style.animationIterationCount = 'infinite';
      if ([1,3,6,8,9].includes(i)) span.style.animationDirection = 'reverse';
    }

    const host = wrap.querySelector('.service-host')?.textContent?.trim();
    const name = wrap.querySelector('.service-name')?.textContent?.trim() || wrap.querySelector('.celestial-name')?.textContent?.trim() || 'Starry App';
    if (host) {
      wrap.dataset.url = `https://${host}/`;
      wrap.setAttribute('role', 'link');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', `${name}，在新視窗開啟 ${host}`);
      wrap.style.cursor = 'pointer';
    }
  });

  function openPlanetApp(wrap, e) {
    if (!wrap?.dataset?.url || performance.now() < suppressPlanetOpenUntil) return;
    const r = wrap.getBoundingClientRect();
    const x = e?.clientX || r.left + r.width / 2;
    const y = e?.clientY || r.top + r.height / 2;
    clickFx(x, y);
    window.open(wrap.dataset.url, '_blank', 'noopener,noreferrer');
  }

  planets.forEach((wrap) => {
    if (!wrap.dataset.url) return;
    wrap.addEventListener('click', (e) => {
      if (performance.now() < suppressPlanetOpenUntil) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      openPlanetApp(wrap, e);
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPlanetApp(wrap, e);
      }
    });
  });

  const immersiveToggle = document.createElement('button');
  immersiveToggle.id = 'immersiveToggle';
  immersiveToggle.type = 'button';
  immersiveToggle.textContent = '✦ 啟動奇幻音樂';
  immersiveToggle.setAttribute('aria-pressed', 'false');
  document.body.appendChild(immersiveToggle);

  function resize() {
    width = innerWidth;
    height = innerHeight;
    // Keep the primary canvas lightweight on high-DPI phones.
    dpr = Math.min(devicePixelRatio || 1, width <= 760 ? 1.35 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = width <= 760
      ? Math.max(88, Math.min(155, Math.floor(width * height / 3400)))
      : Math.max(180, Math.min(520, Math.floor(width * height / 3800)));
    stars = Array.from({ length: count }, makeStar);
    planetSizes = null;
    lastRenderedPlanetYaw = NaN;
    lastPrimaryDraw = 0;
  }

  function makeStar() {
    return {
      x:(Math.random()-.5)*width*1.9,
      y:(Math.random()-.5)*height*1.9,
      z:Math.random()*width+1,
      pz:Math.random()*width+1,
      hue:Math.random()>.88?(Math.random()>.5?205:278):220,
      alpha:.35+Math.random()*.65,
      size:.45+Math.random()*1.65
    };
  }

  function resetStar(s) {
    s.x=(Math.random()-.5)*width*1.9;
    s.y=(Math.random()-.5)*height*1.9;
    s.z=width;
    s.pz=width;
    s.alpha=.35+Math.random()*.65;
    s.size=.45+Math.random()*1.65;
  }

  function viewYaw() { return normAngle(cameraYaw + autoYaw + tiltYaw); }
  // V49: fixed vertical viewing angle across touch, inertia and phone tilt.
  function viewPitch() { return 0; }
  function updateSmoothCamera(now) {
    // Frame-time damping is consistent on 60/90/120Hz phones.
    const delta = lastFrameAt ? clamp(now - lastFrameAt, 8, 50) : 16.7;
    lastFrameAt = now;
    // A touch drag must move every projected planet on the very same frame.
    // Do not delay the camera behind the finger; keep smooth easing only
    // for phone tilt and the inertia after release.
    if (dragging) {
      displayedYaw = viewYaw();
      displayedPitch = viewPitch();
      return;
    }
    const follow = 1 - Math.pow(1 - .17, delta / 16.7);
    displayedYaw = normAngle(displayedYaw + normAngle(viewYaw() - displayedYaw) * follow);
    displayedPitch = 0;
  }

  function renderPlanets() {
    const portrait = width <= 760 && height > width;
    const fovX = portrait ? 138 : 112, fovY = 82;
    const yaw = displayedYaw, pitch = displayedPitch;
    // Cache full planet+title+card dimensions AND the real header/battery
    // height together: no per-frame DOM measurements.
    if (!planetSizes) {
      planetSizes = planets.map(el => ({
        width: el.offsetWidth, height: el.offsetHeight
      }));
      maxPlanetGroupHeight = Math.max(150, ...planetSizes.map(group => group.height));
      protectedHeaderBottom = Math.max(
        document.querySelector('.brand-mark')?.getBoundingClientRect()?.bottom || 0,
        document.querySelector('#starryBatteryCenter')?.getBoundingClientRect()?.bottom || 0
      );
    }
    let visibleCount = 0;
    planets.forEach((el, i) => {
      const p = planetMap[i] || planetMap[0];
      const dyaw = normAngle(p.yaw - yaw);
      const dpitch = p.pitch - pitch;
      // Keep each planet in a fixed, centered height lane at every yaw angle.
      const visual = el.querySelector('.planet');
      const x = width * .5 + (dyaw / (fovX/2)) * width * .5;
      const y = window.starryCenteredPlanetY
        ? window.starryCenteredPlanetY(p.pitch, {
            width,height,headerBottom:protectedHeaderBottom,groupHeight:maxPlanetGroupHeight
          })
        : height * .53 - (p.pitch / 23) * Math.min(90,height*.12);
      const bounds = planetSizes[i] || {width:180,height:180};
      const safe = window.starrySafePlanetPosition
        ? window.starrySafePlanetPosition({x,y,width:bounds.width,height:bounds.height},
            {width,height,headerBottom:protectedHeaderBottom})
        : {x,y,fade:1};
      const centerBoost = Math.max(.68, Math.cos(rad(dyaw)) * Math.cos(rad(dpitch)));
      // Uniform planet base diameter, with gentle depth scaling.
      const scale = p.size * (.95 + centerBoost * .05);
      // Fully opaque until the physical group exits the viewport; never
      // fade the planet and its linked card because of its viewing angle.
      const onScreen = x + bounds.width/2 > 0 && x - bounds.width/2 < width
        && y + bounds.height/2 > 0 && y - bounds.height/2 < height;
      if (onScreen) visibleCount++;
      el.style.opacity = '1';
      el.style.pointerEvents = onScreen && el.dataset.url ? 'auto' : 'none';
      el.style.zIndex = `${Math.round(centerBoost*10)}`;
      el.style.transform = `translate3d(${safe.x}px,${safe.y}px,0) translate(-50%,-50%)`;
      if (visual) visual.style.transform = `scale(${scale})`;
    });
    // No hidden automatic camera recentering; all yaw sectors have planets.
    if (nebulaA) nebulaA.style.transform = `translate3d(${Math.sin(rad(yaw))*-82}px,${pitch*-1.25}px,0) scale(1.1)`;
    if (nebulaB) nebulaB.style.transform = `translate3d(${Math.sin(rad(yaw+90))*68}px,${pitch*.95}px,0) scale(1.08)`;
    // Shared camera frame: the giant sun needs no independent render loop.
    window.starrySolarUpdate?.(yaw,width,height);
  }

  function drawStarfield(now = 0) {
    if (document.hidden) { requestAnimationFrame(drawStarfield); return; }
    const perf = window.starryPerformance;
    const interval = reduceMotion ? 240 : (perf?.primaryInterval?.() || 0);
    const redrawStars = !lastPrimaryDraw || now - lastPrimaryDraw >= interval;
    const elapsedPrimary = lastPrimaryDraw ? Math.max(8,Math.min(100,now-lastPrimaryDraw)) : 16.7;
    if (redrawStars) {
      lastPrimaryDraw = now;
      ctx.clearRect(0,0,width,height);
    }

    // Hold Earth at the landing angle until the user actually swipes.
    // Automatic yaw was slowly moving Earth away from the center each minute.
    // No horizontal or vertical camera drift is added when idle.

    tiltYaw += (targetTiltYaw - tiltYaw) * .16;
    // No vertical sensor movement.
    updateSmoothCamera(now);
    const yaw = displayedYaw, pitch = displayedPitch;
    const cx = width/2 + Math.sin(rad(yaw))*width*.18;
    const cy = height/2 + Math.sin(rad(pitch))*height*.13;
    const speed = reduceMotion ? 0 : Math.max(2.45,width/315);

    const count = redrawStars ? Math.max(12,Math.ceil(stars.length*(perf?.primaryStarFraction?.() || 1))) : 0;
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      s.pz=s.z;
      s.z-=speed*Math.min(5,elapsedPrimary/16.7);
      if (s.z<1) resetStar(s);
      const sx=(s.x/s.z)*width+cx, sy=(s.y/s.z)*width+cy;
      const px=(s.x/s.pz)*width+cx, py=(s.y/s.pz)*width+cy;
      if (sx<-120||sx>width+120||sy<-120||sy>height+120) {
        resetStar(s);
        continue;
      }
      const near=1-s.z/width, lw=Math.max(.35,s.size*near*1.2);
      ctx.beginPath();
      ctx.moveTo(px,py);
      ctx.lineTo(sx,sy);
      ctx.strokeStyle=`hsla(${s.hue},100%,${78+near*20}%,${Math.min(.92,s.alpha*(.3+near))})`;
      ctx.lineWidth=lw;
      ctx.stroke();
    }

    // Do not recompute nine planet cards if the camera is completely still.
    // Drag and inertia remain on the browser's full native frame rate.
    if (dragging || inertiaActive || !Number.isFinite(lastRenderedPlanetYaw)
        || Math.abs(normAngle(displayedYaw-lastRenderedPlanetYaw)) > .02
        || planetSizes === null) {
      renderPlanets();
      lastRenderedPlanetYaw = displayedYaw;
    }
    frame++;
    if (frame%200===0) velocity.textContent=`${(7.8+Math.random()*2.4).toFixed(1)}c`;
    requestAnimationFrame(drawStarfield);
  }

  function spawnMeteor(kind='small') {
    if (reduceMotion || document.hidden) return;
    if (window.starryPerformance?.allowMeteor && !window.starryPerformance.allowMeteor(kind)) return;
    const giant = kind === 'giant';
    const rock = document.createElement('span');
    rock.className = `space-rock ${giant ? 'giant' : 'small'}`;
    const size = giant ? 110 + Math.random()*150 : 4 + Math.random()*12;
    const tail = giant ? 260 + Math.random()*260 : 90 + Math.random()*130;
    const fromLeft = Math.random() < .5;
    const startX = fromLeft ? -size*1.6 : width + size*1.6;
    const startY = height * (.08 + Math.random()*.72);
    const endX = fromLeft ? width + size*2 : -size*2;
    const endY = clamp(startY + (Math.random()-.5)*height*.75, -80, height+80);
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const duration = giant ? 2300 + Math.random()*1800 : 650 + Math.random()*900;

    rock.style.left = `${startX}px`;
    rock.style.top = `${startY}px`;
    rock.style.setProperty('--rock-size', `${size}px`);
    rock.style.setProperty('--tail-size', `${tail}px`);
    rock.style.setProperty('--tail-thickness', `${giant ? 10 + Math.random()*12 : 1 + Math.random()*2}px`);
    rock.style.setProperty('--tail-angle', `${angle}rad`);
    meteorLayer.appendChild(rock);

    const anim = rock.animate([
      { transform:'translate(-50%,-50%) translate3d(0,0,0) scale(.55)', opacity:0 },
      { opacity:1, offset:.12 },
      { transform:`translate(-50%,-50%) translate3d(${dx}px,${dy}px,0) scale(${giant ? 1.08 : 1})`, opacity:0 }
    ], { duration, easing: giant ? 'cubic-bezier(.16,.7,.25,1)' : 'linear', fill:'forwards' });

    anim.onfinish = () => rock.remove();
  }

  function openPortal(button) {
    portalMessage.textContent=phrases[Math.floor(Math.random()*phrases.length)];
    button.classList.remove('flash');
    void button.offsetWidth;
    button.classList.add('flash');
    navigator.vibrate?.(18);
    setTimeout(()=>{
      portalModal.classList.add('open');
      portalModal.setAttribute('aria-hidden','false');
      closeModal.focus({preventScroll:true});
    },160);
  }

  function closePortalFn(){
    portalModal.classList.remove('open');
    portalModal.setAttribute('aria-hidden','true');
  }

  document.querySelectorAll('.portal-btn').forEach(b=>b.addEventListener('click',()=>openPortal(b)));
  closeModal.addEventListener('click',closePortalFn);
  portalModal.addEventListener('click',e=>{if(e.target===portalModal)closePortalFn()});
  addEventListener('keydown',e=>{if(e.key==='Escape')closePortalFn()});

  function ensureAudio() {
    if (audioContext) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioContext = new AC();
    musicGain = audioContext.createGain();
    fxGain = audioContext.createGain();
    musicGain.gain.value = .0001;
    fxGain.gain.value = .85;

    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 520;
    highpass.Q.value = .7;

    const air = audioContext.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 1800;
    air.gain.value = 3.5;

    const delay = audioContext.createDelay(1.2);
    delay.delayTime.value = .31;
    const feedback = audioContext.createGain();
    feedback.gain.value = .22;
    delay.connect(feedback);
    feedback.connect(delay);

    musicGain.connect(highpass);
    highpass.connect(air);
    air.connect(audioContext.destination);
    air.connect(delay);
    delay.connect(audioContext.destination);
    fxGain.connect(audioContext.destination);
  }

  function bell(freq, when, duration=.95, gain=.038, pan=0) {
    if (!audioContext || !musicGain) return;
    const o = audioContext.createOscillator();
    const overtone = audioContext.createOscillator();
    const g = audioContext.createGain();
    const og = audioContext.createGain();
    const p = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;

    o.type='sine';
    overtone.type='sine';
    o.frequency.setValueAtTime(freq,when);
    overtone.frequency.setValueAtTime(freq*2.01,when);
    g.gain.setValueAtTime(.0001,when);
    g.gain.exponentialRampToValueAtTime(gain,when+.018);
    g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    og.gain.setValueAtTime(.0001,when);
    og.gain.exponentialRampToValueAtTime(gain*.22,when+.012);
    og.gain.exponentialRampToValueAtTime(.0001,when+duration*.55);

    o.connect(g);
    overtone.connect(og);
    if (p) {
      p.pan.value=clamp(pan,-1,1);
      g.connect(p);
      og.connect(p);
      p.connect(musicGain);
    } else {
      g.connect(musicGain);
      og.connect(musicGain);
    }
    o.start(when); overtone.start(when);
    o.stop(when+duration+.05); overtone.stop(when+duration+.05);
  }

  const melody = [
    659.25,783.99,1046.5,987.77,783.99,880,1174.66,1046.5,
    698.46,880,1046.5,1318.51,1174.66,987.77,783.99,880
  ];

  function scheduleMelody() {
    clearTimeout(melodyTimer);
    if (!musicOn || !audioContext || document.hidden) return;
    const now = audioContext.currentTime + .04;
    const note = melody[melodyStep % melody.length];
    const accent = melodyStep % 4 === 0;
    bell(note, now, accent ? 1.45 : 1.0, accent ? .052 : .038, Math.sin(melodyStep*.8)*.58);
    if (melodyStep % 4 === 2) bell(note*1.5, now+.19, .72, .018, -.35);
    melodyStep++;
    melodyTimer = setTimeout(scheduleMelody, 680);
  }

  function setMusic(on) {
    ensureAudio();
    if (!audioContext || !musicGain) return;
    musicOn = on;
    audioContext.resume().catch(()=>{});
    const now = audioContext.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(.0001,musicGain.gain.value),now);
    musicGain.gain.exponentialRampToValueAtTime(on ? .16 : .0001, now+.55);
    immersiveToggle.classList.toggle('active',on);
    immersiveToggle.setAttribute('aria-pressed',on?'true':'false');
    immersiveToggle.textContent=on?'♫ 奇幻音樂 ON':'♫ 奇幻音樂 OFF';
    if (on) scheduleMelody(); else clearTimeout(melodyTimer);
  }

  function fxTone(freq=980, duration=.28, gain=.07, pan=0) {
    ensureAudio();
    if (!audioContext || !fxGain) return;
    audioContext.resume().catch(()=>{});
    const now=audioContext.currentTime;
    const o=audioContext.createOscillator();
    const g=audioContext.createGain();
    const p=audioContext.createStereoPanner?audioContext.createStereoPanner():null;
    o.type='sine';
    o.frequency.setValueAtTime(freq,now);
    o.frequency.exponentialRampToValueAtTime(freq*1.72,now+duration*.65);
    g.gain.setValueAtTime(.0001,now);
    g.gain.exponentialRampToValueAtTime(gain,now+.012);
    g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g);
    if(p){p.pan.value=clamp(pan,-1,1);g.connect(p);p.connect(fxGain)}else{g.connect(fxGain)}
    o.start(now);o.stop(now+duration+.03);
  }

  function clickFx(x,y) {
    const burst=document.createElement('div');
    burst.className='click-burst';
    burst.style.left=`${x}px`;
    burst.style.top=`${y}px`;
    for(let i=0;i<12;i++){
      const s=document.createElement('i');
      s.className='click-spark';
      s.style.setProperty('--a',`${i*30+Math.random()*12-6}deg`);
      burst.appendChild(s);
    }
    document.body.appendChild(burst);
    setTimeout(()=>burst.remove(),720);
    fxTone(900+Math.random()*320,.3,.075,(x/Math.max(1,width)-.5)*1.5);
  }

  function isInteractive(target) {
    return target instanceof Element && !!target.closest('button,.portal-modal,a,input,textarea,select');
  }

  function setInteractionMode(on) {
    document.documentElement.dataset.starryInteracting = on ? '1' : '0';
  }

  function startDrag(e) {
    if(e.button!=null&&e.button!==0)return;
    ensureAudio();
    audioContext?.resume().catch(()=>{});
    if(!musicOn)setMusic(true);
    // The transparent native service link fills much of the mobile screen.
    // It must be draggable too, without losing normal tap-to-open behavior.
    dragStartedOnServiceLink = e.pointerType === 'touch'
      && e.target instanceof Element
      && !!e.target.closest('.starry-service-native-link');
    if(isInteractive(e.target) && !dragStartedOnServiceLink)return;
    dragging=true;
    inertiaActive=false;
    setInteractionMode(true);
    pointerId=e.pointerId;
    lastX=e.clientX;
    lastY=e.clientY;
    totalMove=0;
    yawVelocity=0;
    cancelAnimationFrame(inertiaId);
    hint?.classList.add('hidden');
    dragCaptured=false;
    // Do not capture a simple service-card tap (otherwise the link stops
    // opening in mobile browsers). Capture a real swipe only when moving.
    if(!dragStartedOnServiceLink) {
      try{document.body.setPointerCapture(pointerId);dragCaptured=true}catch{}
    }
  }

  function moveDrag(e) {
    if(!dragging||e.pointerId!==pointerId)return;
    e.preventDefault();
    const dx=e.clientX-lastX,dy=e.clientY-lastY;
    lastX=e.clientX;lastY=e.clientY;
    totalMove+=Math.abs(dx)+Math.abs(dy);
    if (dragStartedOnServiceLink && !dragCaptured && totalMove > 14) {
      try{document.body.setPointerCapture(pointerId);dragCaptured=true}catch{}
    }
    const sens=.27;
    cameraYaw=normAngle(cameraYaw-dx*sens);
    // Vertical finger travel does not change the camera.
    yawVelocity=clamp(-dx*sens,-2,2);
  }

  function runInertia() {
    inertiaActive=true;
    yawVelocity*=.84;
    cameraYaw=normAngle(cameraYaw+yawVelocity);
    if(Math.abs(yawVelocity)>.025){
      inertiaId=requestAnimationFrame(runInertia);
    }else{
      inertiaActive=false;
      setInteractionMode(false);
    }
  }

  function endDrag(e) {
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    if(dragCaptured)try{document.body.releasePointerCapture(pointerId)}catch{}
    dragCaptured=false;
    dragStartedOnServiceLink=false;
    pointerId=null;
    if(totalMove<12) {
      setInteractionMode(false);
      clickFx(e.clientX,e.clientY);
    } else {
      suppressPlanetOpenUntil = performance.now() + 350;
      runInertia();
    }
  }

  addEventListener('pointerdown',startDrag,{passive:true});
  addEventListener('pointermove',moveDrag,{passive:false});
  addEventListener('pointerup',endDrag,{passive:true});
  addEventListener('pointercancel',endDrag,{passive:true});
  addEventListener('click',e=>{
    if(isInteractive(e.target)) clickFx(e.clientX,e.clientY);
  },{passive:true});

  function screenAngle(){
    return screen.orientation&&typeof screen.orientation.angle==='number'
      ?screen.orientation.angle
      :(typeof orientation==='number'?orientation:0);
  }

  function handleOrientation(e) {
    if(e.beta==null||e.gamma==null)return;
    if(!calibration){calibration={beta:e.beta,gamma:e.gamma};return}
    const db=clamp(e.beta-calibration.beta,-24,24);
    const dg=clamp(e.gamma-calibration.gamma,-24,24);
    const a=((screenAngle()%360)+360)%360;
    let x=dg,y=db;
    if(a===90){x=db;y=-dg}else if(a===270){x=-db;y=dg}
    else if(a===180){x=-dg;y=-db}
    // Original pre-#41 motion sensitivity, keeping current touch drag intact.
    targetTiltYaw = clamp(x / 24,-1,1) * 6;
    // Vertical tilt remains locked at zero.
  }

  function attachMotion(){
    if(motionAttached||!('DeviceOrientationEvent'in window))return;
    addEventListener('deviceorientation',handleOrientation,{passive:true});
    motionAttached=true;
  }

  async function enableMotion(){
    if(!('DeviceOrientationEvent'in window))return false;
    const D=window.DeviceOrientationEvent;
    if(typeof D.requestPermission==='function'){
      try{if(await D.requestPermission()!=='granted')return false}catch{return false}
    }
    calibration=null;
    attachMotion();
    return true;
  }

  immersiveToggle.addEventListener('click',async(e)=>{
    e.stopPropagation();
    const on=!musicOn;
    setMusic(on);
    if(on)await enableMotion();
  });

  if('DeviceOrientationEvent'in window&&typeof window.DeviceOrientationEvent.requestPermission!=='function')attachMotion();
  // iOS requires permission in an actual gesture, not the auto-music click.
  if('DeviceOrientationEvent'in window&&typeof window.DeviceOrientationEvent.requestPermission==='function'){
    addEventListener('pointerdown',()=>{
      if(motionAttached || motionPermissionAttempted) return;
      motionPermissionAttempted = true;
      void enableMotion();
    },{passive:true});
  }
  addEventListener('orientationchange',()=>{calibration=null;targetTiltYaw=0;},{passive:true});

  addEventListener('resize',resize,{passive:true});
  document.fonts?.ready?.then(() => { planetSizes = null; lastRenderedPlanetYaw = NaN; });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      lastPrimaryDraw=0;
      lastRenderedPlanetYaw=NaN;
      sector.textContent=sectors[Math.floor(Math.random()*sectors.length)];
      if(musicOn){audioContext?.resume().catch(()=>{});scheduleMelody()}
    }else{
      clearTimeout(melodyTimer);
      audioContext?.suspend().catch(()=>{});
    }
  });

  // A bfcache return counts as entering the site again.
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    cancelAnimationFrame(inertiaId);
    dragging = false;
    inertiaActive = false;
    yawVelocity = 0;
    cameraYaw = 80;
    displayedYaw = 80;
    autoYaw = 0;
    tiltYaw = 0;
    targetTiltYaw = 0;
    lastPrimaryDraw=0;
    lastRenderedPlanetYaw=NaN;
    setInteractionMode(false);
    renderPlanets();
  });
  resize();
  requestAnimationFrame(drawStarfield);
  setTimeout(()=>hint?.classList.add('hidden'),6500);
  if(!reduceMotion){
    setInterval(()=>spawnMeteor('small'),900);
    setTimeout(()=>spawnMeteor('giant'),1700);
    setInterval(()=>spawnMeteor('giant'),6200);
    setInterval(()=>sector.textContent=sectors[Math.floor(Math.random()*sectors.length)],7200);
  }
})();
