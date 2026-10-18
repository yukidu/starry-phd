// universe-readability-v41: larger service cards and double-size planet names.
(() => {
  const style=document.createElement('style');
  style.dataset.universeReadability='v41';
  style.textContent=`
    /* Every planet shares Earth's CSS diameter (desktop and phone). */
    :root{--starry-earth-diameter:64px}
    @media(max-width:760px){:root{--starry-earth-diameter:52px}}
    .planet-wrap > .planet{
      width:var(--starry-earth-diameter)!important;
      height:var(--starry-earth-diameter)!important;
    }
    /* Saturn's total ring width is also kept under 1.2 Earth sizes. */
    .planet-wrap .saturn .ring{
      box-sizing:border-box!important;
      width:calc(var(--starry-earth-diameter) * 1.10)!important;
      height:calc(var(--starry-earth-diameter) * .36)!important;
      border-width:4px!important;
    }
    .planet-wrap .jupiter > span::before{
      width:26%!important;height:12%!important;
      right:15%!important;top:56%!important;
    }
    .planet-wrap em.service-label{
      min-width:min(196px,calc(100vw - 30px))!important;
      max-width:calc(100vw - 30px)!important;
      padding:12px 16px 13px!important;border-radius:16px!important;
      background:rgba(3,9,24,.91)!important;
      box-shadow:0 0 24px rgba(82,178,255,.18),0 10px 26px rgba(0,0,0,.3)!important;
      white-space:normal!important;
    }
    .planet-wrap .service-name{
      font-size:21px!important;line-height:1.24!important;font-weight:800!important;
      overflow-wrap:anywhere;
    }
    .planet-wrap .service-host{
      margin-top:6px!important;font-size:13px!important;line-height:1.25!important;
      letter-spacing:.035em!important;overflow-wrap:anywhere;
    }
    .planet-wrap > .celestial-name{
      font-size:18px!important;font-weight:800!important;line-height:1.3!important;
      color:rgba(243,252,255,.96)!important;letter-spacing:.1em!important;
      text-shadow:0 1px 7px rgba(0,0,0,.92),0 0 12px rgba(125,249,255,.62)!important;
      margin-bottom:11px!important;padding:4px 8px!important;
      background:transparent!important;border:0!important;
      border-radius:0!important;box-shadow:none!important;
      backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
      z-index:10!important;
    }
    .planet-wrap.p5 > .celestial-name{margin-bottom:22px!important}
    .planet-wrap.p6 > .celestial-name{margin-bottom:28px!important}
    .planet-wrap.p5 em.service-label{margin-top:26px!important}
    .planet-wrap.p6 em.service-label{margin-top:26px!important}
    .earth-moon-companion .celestial-name{
      font-size:16px!important;background:transparent!important;
      border:0!important;box-shadow:none!important;
    }
    @media(min-width:768px){
      .planet-wrap em.service-label{min-width:260px!important;padding:16px 22px 18px!important;border-radius:18px!important}
      .planet-wrap .service-name{font-size:29px!important}
      .planet-wrap .service-host{font-size:17px!important}
      .planet-wrap > .celestial-name{font-size:22px!important}
    }
    @media(min-width:1200px){
      .planet-wrap em.service-label{min-width:302px!important;padding:18px 24px 20px!important}
      .planet-wrap .service-name{font-size:34px!important}
      .planet-wrap .service-host{font-size:19px!important}
      .planet-wrap > .celestial-name{font-size:26px!important}
    }
    @media(max-width:390px){
      .planet-wrap em.service-label{min-width:min(182px,calc(100vw - 26px))!important;padding:11px 12px!important}
      .planet-wrap .service-name{font-size:19px!important}
      .planet-wrap .service-host{font-size:12px!important}
    }
  `;
  document.head.appendChild(style);
})();
