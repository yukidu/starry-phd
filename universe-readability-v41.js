// universe-readability-v41: retain larger type, fit the actual text width.
(() => {
  const style=document.createElement('style');
  style.dataset.universeReadability='v42';
  style.textContent=`
    .planet-wrap em.service-label{
      display:inline-flex!important;flex-direction:column!important;
      align-items:center!important;justify-content:center!important;
      box-sizing:border-box!important;
      width:max-content!important;min-width:0!important;
      max-width:min(255px,calc(100vw - 28px))!important;
      padding:10px 12px!important;
      border-radius:13px!important;
      background:rgba(3,9,24,.91)!important;
      box-shadow:0 0 20px rgba(82,178,255,.17),0 8px 24px rgba(0,0,0,.28)!important;
      white-space:normal!important;
    }
    .planet-wrap .service-name{
      display:block!important;max-width:100%!important;
      font-size:21px!important;line-height:1.24!important;font-weight:800!important;
      white-space:normal!important;overflow-wrap:anywhere;
    }
    .planet-wrap .service-host{
      display:block!important;max-width:100%!important;
      margin-top:5px!important;font-size:13px!important;line-height:1.22!important;
      letter-spacing:.025em!important;white-space:normal!important;overflow-wrap:anywhere;
    }
    .planet-wrap > .celestial-name{
      font-size:18px!important;font-weight:800!important;line-height:1.3!important;
      color:rgba(243,252,255,.96)!important;letter-spacing:.1em!important;
      text-shadow:0 1px 7px rgba(0,0,0,.92),0 0 12px rgba(125,249,255,.62)!important;
      margin-bottom:10px!important;padding:4px 8px!important;
      background:rgba(3,9,24,.66);border-radius:7px;z-index:10!important;
    }
    .planet-wrap.p5 > .celestial-name{margin-bottom:16px!important}
    .planet-wrap.p6 > .celestial-name{margin-bottom:21px!important}
    .planet-wrap.p5 em.service-label{margin-top:19px!important}
    .planet-wrap.p6 em.service-label{margin-top:24px!important}
    .earth-moon-companion .celestial-name{font-size:16px!important}
    @media(min-width:768px){
      .planet-wrap em.service-label{
        max-width:320px!important;padding:13px 15px!important;border-radius:15px!important
      }
      .planet-wrap .service-name{font-size:29px!important}
      .planet-wrap .service-host{font-size:17px!important}
      .planet-wrap > .celestial-name{font-size:22px!important}
    }
    @media(min-width:1200px){
      .planet-wrap em.service-label{max-width:370px!important;padding:16px 18px!important}
      .planet-wrap .service-name{font-size:34px!important}
      .planet-wrap .service-host{font-size:19px!important}
      .planet-wrap > .celestial-name{font-size:26px!important}
    }
    @media(max-width:390px){
      .planet-wrap em.service-label{max-width:calc(100vw - 26px)!important;padding:10px 11px!important}
      .planet-wrap .service-name{font-size:19px!important}
      .planet-wrap .service-host{font-size:12px!important}
    }
  `;
  document.head.appendChild(style);
})();
