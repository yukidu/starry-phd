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
      box-sizing:border-box!important;
      display:flex!important;flex-direction:column!important;align-items:center!important;
      width:max-content!important;min-width:0!important;
      max-width:calc(100vw - 26px)!important;
      padding:8px 10px!important;border-radius:12px!important;
      /* Match the Google account picker frame, at a card-sized scale. */
      border:1px solid rgba(105,232,255,.38)!important;
      background:linear-gradient(160deg,
        rgba(5,17,39,.98),rgba(5,8,24,.985) 58%,rgba(25,8,46,.98))!important;
      box-shadow:0 0 24px rgba(66,187,255,.16),0 10px 28px rgba(0,0,0,.52)!important;
      overflow:hidden!important;white-space:normal!important;
    }
    .planet-wrap em.service-label::before{
      content:"";position:absolute;left:12%;right:12%;top:0;height:1px;
      background:linear-gradient(90deg,transparent,#7df9ff,transparent);
      box-shadow:0 0 16px #7df9ff;pointer-events:none;
    }
    .planet-wrap em.service-label .starry-service-native-link{
      border-radius:inherit!important;
    }
    .planet-wrap em.service-label{
    }
    .planet-wrap .service-name{
      font-size:20px!important;line-height:1.22!important;font-weight:800!important;
      overflow-wrap:anywhere;
    }
    .planet-wrap .service-host{
      margin-top:4px!important;font-size:12px!important;line-height:1.2!important;
      letter-spacing:.035em!important;overflow-wrap:anywhere;
    }
    .planet-wrap > .celestial-name{
      font-size:18px!important;font-weight:400!important;line-height:1.15!important;
      color:rgba(243,252,255,.50)!important;letter-spacing:.08em!important;
      text-shadow:0 1px 5px rgba(0,0,0,.6),0 0 8px rgba(125,249,255,.25)!important;
      margin-bottom:-3px!important;padding:0 4px!important;
      background:transparent!important;border:0!important;
      border-radius:0!important;box-shadow:none!important;
      backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
      z-index:10!important;
    }
    .planet-wrap.p5 > .celestial-name{margin-bottom:0!important}
    .planet-wrap.p6 > .celestial-name{margin-bottom:0!important}
    .planet-wrap.p5 em.service-label{margin-top:26px!important}
    .planet-wrap.p6 em.service-label{margin-top:26px!important}
    .earth-moon-companion .celestial-name{
      font-size:16px!important;font-weight:400!important;
      color:rgba(243,252,255,.50)!important;background:transparent!important;
      border:0!important;box-shadow:none!important;
    }
    @media(min-width:768px){
      .planet-wrap em.service-label{min-width:0!important;max-width:min(330px,calc(100vw - 30px))!important;padding:11px 14px!important;border-radius:14px!important}
      .planet-wrap .service-name{font-size:25px!important}
      .planet-wrap .service-host{font-size:15px!important}
      .planet-wrap > .celestial-name{font-size:22px!important}
    }
    @media(min-width:1200px){
      .planet-wrap em.service-label{min-width:0!important;max-width:min(370px,calc(100vw - 36px))!important;padding:12px 16px!important}
      .planet-wrap .service-name{font-size:29px!important}
      .planet-wrap .service-host{font-size:17px!important}
      .planet-wrap > .celestial-name{font-size:26px!important}
    }
    @media(max-width:390px){
      .planet-wrap em.service-label{min-width:0!important;max-width:calc(100vw - 24px)!important;padding:7px 9px!important}
      .planet-wrap .service-name{font-size:18px!important}
      .planet-wrap .service-host{font-size:11px!important}
    }
  `;
  document.head.appendChild(style);
})();
