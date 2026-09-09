'use strict';

(() => {
  const VERSION='seed-man-world-five-compat-v20';
  const RELEASE='20260908-r20';
  const load=(src,key)=>new Promise((resolve,reject)=>{
    if(document.querySelector(`script[data-${key}]`)) return resolve();
    const script=document.createElement('script');
    script.src=`${src}?v=${RELEASE}`;
    script.async=false;
    script.dataset[key]='1';
    script.addEventListener('load',resolve,{once:true});
    script.addEventListener('error',reject,{once:true});
    document.head.append(script);
  });

  async function install(){
    try {
      if(!window.__SEED_MAN_APPROVED_IMAGES__) await load('./approved-art-core-v1.js','seedManApprovedCore');
      if(!window.__SEED_MAN_CAMPAIGN_V20__) await load('./campaign-runtime-v20.js','seedManCampaignV20');
      if(document.documentElement.dataset.sproutCampaignUi!=='seed-man-campaign-ui-v20') await load('./campaign-ui-v20.js','seedManCampaignUiV20');
      document.documentElement.dataset.sproutWorldFive=VERSION;
      document.documentElement.dataset.seedManLegacyWorldFive='retired';
      document.documentElement.dataset.sproutCampaignLevels='20';
    } catch(error) {
      console.error('[Seed Man] v20 campaign bootstrap failed.',error);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.__SEED_MAN_WORLD_FIVE__=Object.freeze({version:VERSION,legacyExtensionRetired:true,campaignTarget:20});
})();
