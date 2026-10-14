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
    { yaw: 0, pitch: -8, size: .88 },
    { yaw: 38, pitch: 12, size: .98 },
    { yaw: 82, pitch: -2, size: 1.08 },
    { yaw: 126, pitch: 18, size: .92 },
    { yaw: 172, pitch: -11, size: 1.28 },
    { yaw: 216, pitch: 7, size: 1.2 },
    { yaw: 258, pitch: -18, size: .96 },
    { yaw: 304, pitch: 13, size: 1.02 },
    { yaw: 340, pitch: 25, size: .8 }
  ];
  const spinDurations = [9,14,18,12,11,16,13,15,10];

  let width = innerWidth, height = innerHeight, dpr = 1, stars = [], frame = 0;
  let cameraYaw = 0, cameraPitch = 0, tiltYaw = 0, tiltPitch = 0;
  let dragging = false, pointerId = null, lastX = 0, lastY = 0, totalMove = 0;
  let yawVelocity = 0, pitchVelocity = 0, inertiaId = 0;
  let motionAttached = false, calibration = null;
  let audioContext = null, masterGain = null, musicBuilt = false, musicOn = false, chimeTimer = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const normAngle = (a) => ((a + 540) % 360) - 180;
  const rad = (d) => d * Math.PI / 180;

  planets.forEach((wrap, i) => {
    const span = wrap.querySelector('.planet > span');
    if (span) {
      span.style.animationDuration = `${spinDurations[i]}s`;
      span.style.animationTimingFunction = 'linear';
      span.style.animationIterationCount = 'infinite';
      if ([1,3,6,8].includes(i)) span.style.animationDirection = 'reverse';
    }
  });

  const immersiveToggle = document.createElement('button');
  immersiveToggle.id = 'immersiveToggle';
  immersiveToggle.type = 'button';
  immersiveToggle.textContent = '✦ 啟動沉浸模式';
  immersiveToggle.setAttribute('aria-pressed', 'false');
  document.body.appendChild(immersiveToggle);

  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(180, Math.min(520, Math.floor(width * height / 3800)));
    stars = Array.from({ length: count }, makeStar);
    renderPlanets();
  }

  function makeStar() {
    return {
      x:(Math.random()-.5)*width*1.9, y:(Math.random()-.5)*height*1.9,
      z:Math.random()*width+1, pz:Math.random()*width+1,
      hue:Math.random()>.88?(Math.random()>.5?205:278):220,
      alpha:.35+Math.random()*.65, size:.45+Math.random()*1.65
    };
  }
  function resetStar(s) {
    s.x=(Math.random()-.5)*width*1.9; s.y=(Math.random()-.5)*height*1.9;
    s.z=width; s.pz=width; s.alpha=.35+Math.random()*.65; s.size=.45+Math.random()*1.65;
  }

  function renderPlanets() {
    const fovX = 112, fovY = 82;
    const yaw = cameraYaw + tiltYaw;
    const pitch = cameraPitch + tiltPitch;
    planets.forEach((el, i) => {
      const p = planetMap[i];
      const dyaw = normAngle(p.yaw - yaw);
      const dpitch = p.pitch - pitch;
      const visible = Math.abs(dyaw) < fovX * .62 && Math.abs(dpitch) < fovY * .68;
      if (!visible) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
      const x = width * .5 + (dyaw / (fovX/2)) * width * .5;
      const y = height * .47 - (dpitch / (fovY/2)) * height * .5;
      const centerBoost = Math.max(.68, Math.cos(rad(dyaw)) * Math.cos(rad(dpitch)));
      const scale = p.size * (.82 + centerBoost * .32);
      el.style.left = '0'; el.style.top = '0'; el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.opacity = `${clamp((centerBoost-.5)*2.2,.22,1)}`;
      el.style.zIndex = `${Math.round(centerBoost*10)}`;
      el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`;
    });
    if (nebulaA) nebulaA.style.transform = `translate3d(${Math.sin(rad(yaw))*-70}px,${pitch*-1.2}px,0) scale(1.08)`;
    if (nebulaB) nebulaB.style.transform = `translate3d(${Math.sin(rad(yaw+90))*55}px,${pitch*.9}px,0) scale(1.05)`;
  }

  function drawStarfield() {
    ctx.clearRect(0,0,width,height);
    const yaw = cameraYaw + tiltYaw, pitch = cameraPitch + tiltPitch;
    const cx = width/2 + Math.sin(rad(yaw))*width*.16;
    const cy = height/2 + Math.sin(rad(pitch))*height*.12;
    const speed = reduceMotion ? 0 : Math.max(2.3,width/330);
    for (const s of stars) {
      s.pz=s.z; s.z-=speed; if (s.z<1) resetStar(s);
      const sx=(s.x/s.z)*width+cx, sy=(s.y/s.z)*width+cy;
      const px=(s.x/s.pz)*width+cx, py=(s.y/s.pz)*width+cy;
      if (sx<-120||sx>width+120||sy<-120||sy>height+120) { resetStar(s); continue; }
      const near=1-s.z/width, lw=Math.max(.35,s.size*near*1.2);
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy);
      ctx.strokeStyle=`hsla(${s.hue},100%,${78+near*20}%,${Math.min(.92,s.alpha*(.3+near))})`;
      ctx.lineWidth=lw; ctx.stroke();
    }
    renderPlanets();
    frame++; if (frame%200===0) velocity.textContent=`${(7.8+Math.random()*2.4).toFixed(1)}c`;
    requestAnimationFrame(drawStarfield);
  }

  function spawnMeteor() {
    if (reduceMotion || document.hidden) return;
    const m=document.createElement('span'); m.className='meteor';
    m.style.left=`${58+Math.random()*42}%`; m.style.top=`${Math.random()*42}%`;
    m.style.animationDuration=`${.8+Math.random()*.8}s`; meteorLayer.appendChild(m);
    m.addEventListener('animationend',()=>m.remove(),{once:true});
  }

  function openPortal(button) {
    portalMessage.textContent=phrases[Math.floor(Math.random()*phrases.length)];
    button.classList.remove('flash'); void button.offsetWidth; button.classList.add('flash');
    navigator.vibrate?.(18);
    setTimeout(()=>{ portalModal.classList.add('open'); portalModal.setAttribute('aria-hidden','false'); closeModal.focus({preventScroll:true}); },160);
  }
  function closePortalFn(){ portalModal.classList.remove('open'); portalModal.setAttribute('aria-hidden','true'); }
  document.querySelectorAll('.portal-btn').forEach(b=>b.addEventListener('click',()=>openPortal(b)));
  closeModal.addEventListener('click',closePortalFn);
  portalModal.addEventListener('click',e=>{if(e.target===portalModal)closePortalFn()});
  addEventListener('keydown',e=>{if(e.key==='Escape')closePortalFn()});

  function createMusic() {
    if (musicBuilt) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    audioContext=new AC(); masterGain=audioContext.createGain(); masterGain.gain.value=.0001;
    const high=audioContext.createBiquadFilter(); high.type='highpass'; high.frequency.value=260; high.Q.value=.72;
    const low=audioContext.createBiquadFilter(); low.type='lowpass'; low.frequency.value=5600; low.Q.value=.45;
    const delay=audioContext.createDelay(1); delay.delayTime.value=.24;
    const feedback=audioContext.createGain(); feedback.gain.value=.16; delay.connect(feedback); feedback.connect(delay);
    high.connect(low); low.connect(masterGain); low.connect(delay); delay.connect(masterGain); masterGain.connect(audioContext.destination);
    [261.63,392,523.25,659.25].forEach((freq,i)=>{
      const o=audioContext.createOscillator(), g=audioContext.createGain();
      o.type=i%2?'sine':'triangle'; o.frequency.value=freq; o.detune.value=i%2?3:-3; g.gain.value=i<2?.018:.012;
      o.connect(g); g.connect(high); o.start();
    });
    musicBuilt=true;
  }

  function crystalTone(freq=880, duration=.42, gainValue=.05, pan=0) {
    createMusic(); if(!audioContext||!masterGain) return;
    audioContext.resume().catch(()=>{});
    const now=audioContext.currentTime, o=audioContext.createOscillator(), g=audioContext.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,now); o.frequency.exponentialRampToValueAtTime(freq*1.45,now+duration*.55);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(gainValue,now+.015); g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    if(audioContext.createStereoPanner){const p=audioContext.createStereoPanner();p.pan.value=clamp(pan,-1,1);o.connect(g);g.connect(p);p.connect(masterGain)}else{o.connect(g);g.connect(masterGain)}
    o.start(now); o.stop(now+duration+.03);
  }

  function playAmbientChime() {
    if(!musicOn||document.hidden) return;
    const notes=[523.25,659.25,783.99,880,1046.5,1174.66];
    crystalTone(notes[Math.floor(Math.random()*notes.length)],2.5,.025,Math.random()*1.2-.6);
  }
  function scheduleChime(){clearTimeout(chimeTimer);if(!musicOn)return;chimeTimer=setTimeout(()=>{playAmbientChime();scheduleChime()},2600+Math.random()*3600)}
  function setMusic(on){createMusic();if(!audioContext||!masterGain)return;musicOn=on;audioContext.resume().catch(()=>{});const now=audioContext.currentTime;masterGain.gain.cancelScheduledValues(now);masterGain.gain.setValueAtTime(Math.max(.0001,masterGain.gain.value),now);masterGain.gain.exponentialRampToValueAtTime(on?.13:.0001,now+.7);immersiveToggle.classList.toggle('active',on);immersiveToggle.setAttribute('aria-pressed',on?'true':'false');immersiveToggle.textContent=on?'♫ 宇宙音場 ON':'♫ 宇宙音場 OFF';if(on){playAmbientChime();scheduleChime()}else clearTimeout(chimeTimer)}

  function clickFx(x,y){
    const burst=document.createElement('div');burst.className='click-burst';burst.style.left=`${x}px`;burst.style.top=`${y}px`;
    for(let i=0;i<12;i++){const s=document.createElement('i');s.className='click-spark';s.style.setProperty('--a',`${i*30+Math.random()*12-6}deg`);burst.appendChild(s)}
    document.body.appendChild(burst);setTimeout(()=>burst.remove(),720);
    crystalTone(760+Math.random()*260,.34,.06,(x/Math.max(1,width)-.5)*1.5);
  }

  function startDrag(e){
    if(e.button!=null&&e.button!==0)return;
    dragging=true;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;totalMove=0;yawVelocity=pitchVelocity=0;
    cancelAnimationFrame(inertiaId);hint?.classList.add('hidden');
    try{document.body.setPointerCapture(pointerId)}catch{}
    createMusic();audioContext?.resume().catch(()=>{});if(!musicOn)setMusic(true);
  }
  function moveDrag(e){
    if(!dragging||e.pointerId!==pointerId)return;e.preventDefault();
    const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;totalMove+=Math.abs(dx)+Math.abs(dy);
    const sens=.23;cameraYaw=normAngle(cameraYaw-dx*sens);cameraPitch=clamp(cameraPitch+dy*sens,-62,62);yawVelocity=-dx*sens;pitchVelocity=dy*sens;
  }
  function runInertia(){yawVelocity*=.92;pitchVelocity*=.9;cameraYaw=normAngle(cameraYaw+yawVelocity);cameraPitch=clamp(cameraPitch+pitchVelocity,-62,62);if(Math.abs(yawVelocity)>.015||Math.abs(pitchVelocity)>.015)inertiaId=requestAnimationFrame(runInertia)}
  function endDrag(e){
    if(!dragging||e.pointerId!==pointerId)return;dragging=false;try{document.body.releasePointerCapture(pointerId)}catch{};pointerId=null;
    if(totalMove<12)clickFx(e.clientX,e.clientY);else runInertia();
  }
  addEventListener('pointerdown',startDrag,{passive:true});
  addEventListener('pointermove',moveDrag,{passive:false});
  addEventListener('pointerup',endDrag,{passive:true});
  addEventListener('pointercancel',endDrag,{passive:true});

  function screenAngle(){return screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:(typeof orientation==='number'?orientation:0)}
  function handleOrientation(e){
    if(e.beta==null||e.gamma==null)return;if(!calibration){calibration={beta:e.beta,gamma:e.gamma};return}
    const db=clamp(e.beta-calibration.beta,-24,24),dg=clamp(e.gamma-calibration.gamma,-24,24),a=((screenAngle()%360)+360)%360;
    let x=dg,y=db;if(a===90){x=db;y=-dg}else if(a===270){x=-db;y=dg}
    tiltYaw=clamp(x/24,-1,1)*6;tiltPitch=clamp(y/24,-1,1)*4;
  }
  function attachMotion(){if(motionAttached||!('DeviceOrientationEvent'in window))return;addEventListener('deviceorientation',handleOrientation,{passive:true});motionAttached=true}
  async function enableMotion(){if(!('DeviceOrientationEvent'in window))return false;const D=window.DeviceOrientationEvent;if(typeof D.requestPermission==='function'){try{if(await D.requestPermission()!=='granted')return false}catch{return false}}calibration=null;attachMotion();return true}

  immersiveToggle.addEventListener('click',async(e)=>{e.stopPropagation();const on=!musicOn;setMusic(on);if(on)await enableMotion()});
  if('DeviceOrientationEvent'in window&&typeof window.DeviceOrientationEvent.requestPermission!=='function')attachMotion();

  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){sector.textContent=sectors[Math.floor(Math.random()*sectors.length)];if(musicOn){audioContext?.resume().catch(()=>{});scheduleChime()}}else{clearTimeout(chimeTimer);audioContext?.suspend().catch(()=>{})}});

  resize();drawStarfield();setTimeout(()=>hint?.classList.add('hidden'),6500);
  if(!reduceMotion){setInterval(spawnMeteor,1700);setInterval(()=>sector.textContent=sectors[Math.floor(Math.random()*sectors.length)],7200)}
})();
