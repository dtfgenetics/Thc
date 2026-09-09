'use strict';

(() => {
  const VERSION='seed-man-v20-campaign-guard-v1';
  const RETIRED_POWER_TYPES=new Set(['speed','shield','magnet','jump']);

  function reconcileLevel(){
    if(typeof level==='undefined'||!level)return;
    if(!/^\d-\d-/.test(String(level.id||'')))return;
    const retired=(level.powerups||[]).filter((powerup)=>RETIRED_POWER_TYPES.has(powerup?.type));
    if(retired.length)level.powerups=[];
    level.phenotypeForms=['plant','fire','electric','ice'];
    level.phenotypeDurationMs=30000;
    if(typeof player!=='undefined'&&player?.power){
      player.power.speedTimer=0;player.power.jumpTimer=0;player.power.magnetTimer=0;player.power.shieldCharges=0;
      if(Array.isArray(player.collectedPowerups))player.collectedPowerups=[];
    }
    document.documentElement.dataset.seedManCampaignGuard=VERSION;
  }

  window.addEventListener('sprout:level-selected',()=>queueMicrotask(reconcileLevel));
  window.addEventListener('load',()=>setTimeout(reconcileLevel,0),{once:true});
  window.__SEED_MAN_V20_CAMPAIGN_GUARD__=Object.freeze({version:VERSION,reconcile:reconcileLevel,retiredPowerTypes:Object.freeze([...RETIRED_POWER_TYPES])});
})();
