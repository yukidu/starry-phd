// One reward grade for each of twelve displayed meteor diameter ranges.
(() => {
  const cents=Object.freeze([100,11,10,9,8,7,6,5,4,3,2,1]);
  window.starryMeteorRewardTier=(diameter)=>{
    const size=Number(diameter);
    if(!Number.isFinite(size))return null;
    const level=Math.max(1,Math.min(12,1+Math.floor((size-18)/18*12)));
    return {level,hundredths:cents[level-1]};
  };
})();
