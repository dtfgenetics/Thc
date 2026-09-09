'use strict';

(() => {
  const VERSION='sprout-canvas-compat-v20';
  const RELEASE='20260908-r20';
  const proto=window.HTMLCanvasElement?.prototype;
  const nativeGetContext=proto?.getContext;
  let combatLoaded=false;
  let enemyLoaded=false;
  let uiLoaded=false;
  let campaignLoaded=false;
  let artLoaded=false;
  let attempts=0;

  if(proto&&typeof nativeGetContext==='function'){
    proto.getContext=function(type,attributes){
      if(this.id!=='game'||type!=='2d') return nativeGetContext.call(this,type,attributes);
      const preferred={...(attributes||{}),alpha:false,desynchronized:false,willReadFrequently:true};
      try{return nativeGetContext.call(this,type,preferred)||nativeGetContext.call(this,type,attributes)||nativeGetContext.call(this,type);}catch{return nativeGetContext.call(this,type,attributes)||nativeGetContext.call(this,type);}
    };
  }

  function hasScript(src){return [...document.scripts].some((s)=>String(s.src||'').includes(src));}
  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      if(hasScript(src)||document.querySelector(`script[data-${key}]`)) return resolve();
      const script=document.createElement('script');
      script.src=`${src}?v=${RELEASE}`;
      script.async=false;
      script.dataset[key]='1';
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',reject,{once:true});
      document.body.append(script);
    });
  }

  async function installCanonicalRuntime(){
    try{
      if(!window.__SEED_MAN_APPROVED_ART_CORE__) await loadScript('./approved-art-core-v1.js','seedApprovedArtCoreV20');
      if(!window.__SEED_MAN_APPROVED_ART_RUNTIME__) await loadScript('./approved-art-runtime-v1.js','seedApprovedArtRuntimeV20');
      artLoaded=Boolean(window.__SEED_MAN_APPROVED_ART_CORE__||window.__SEED_MAN_APPROVED_ART_RUNTIME__);
      if(window.__SPROUT_CAMPAIGN__?.levelCount!==20) await loadScript('./campaign-v20-runtime.js','seedCampaignRuntimeV20');
      campaignLoaded=window.__SPROUT_CAMPAIGN__?.levelCount===20||Boolean(window.__SEED_MAN_CAMPAIGN_V20__);
    }catch(error){console.error('[Seed Man] canonical v20 bootstrap failed.',error);}
  }

  async function installAdapters(){
    if(typeof stepPlayer!=='function'||typeof render!=='function'||typeof reset!=='function'){
      attempts+=1;
      if(attempts<120) setTimeout(installAdapters,25);
      return;
    }
    try{
      if(window.__SPROUT_COMBAT_BROWSER__?.installed!==true) await loadScript('./combat-browser-v1.js','seedCombatBrowserV20');
      combatLoaded=window.__SPROUT_COMBAT_BROWSER__?.installed===true;
      if(combatLoaded&&window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed!==true) await loadScript('./enemy-attacks-browser-v1.js','seedEnemyAttacksV20');
      enemyLoaded=window.__SPROUT_ENEMY_ATTACKS_BROWSER__?.installed===true;
    }catch(error){console.error('[Seed Man] gameplay adapter load failed.',error);}
  }

  async function installCampaignUi(){
    if(window.__SPROUT_CAMPAIGN__?.levelCount!==20){setTimeout(installCampaignUi,25);return;}
    try{
      if(document.documentElement.dataset.sproutCampaignUi!=='seed-man-campaign-ui-v20') await loadScript('./campaign-ui-v20.js','seedCampaignUiV20');
      uiLoaded=document.documentElement.dataset.sproutCampaignUi==='seed-man-campaign-ui-v20';
    }catch(error){console.error('[Seed Man] 20-level campaign UI failed to load.',error);}
  }

  async function boot(){
    await installCanonicalRuntime();
    installAdapters();
    installCampaignUi();
  }

  function redraw(){requestAnimationFrame(()=>{try{if(typeof render==='function')render();}catch{}});}
  window.addEventListener('pageshow',redraw);
  window.addEventListener('orientationchange',redraw);
  window.addEventListener('resize',redraw,{passive:true});
  window.addEventListener('sprout:level-selected',(event)=>{const title=event?.detail?.level?.title||'Seed Man';document.title=`Seed Man: ${title} | DTF Genetics`;});
  window.addEventListener('DOMContentLoaded',()=>{void boot();},{once:true});
  window.addEventListener('load',()=>{void boot();},{once:true});

  window.__SPROUT_CANVAS_COMPAT__=Object.freeze({version:VERSION,release:RELEASE,campaignUi:'seed-man-campaign-ui-v20',campaignTarget:20,approvedArtTarget:'approved-showcase-2026-09-08',combatBrowserAutoLoad:true,enemyAttackBrowserAutoLoad:true,get combatLoaded(){return combatLoaded;},get enemyAttacksLoaded(){return enemyLoaded;},get campaignUiLoaded(){return uiLoaded;},get campaignLoaded(){return campaignLoaded;},get approvedArtLoaded(){return artLoaded;}});
})();
