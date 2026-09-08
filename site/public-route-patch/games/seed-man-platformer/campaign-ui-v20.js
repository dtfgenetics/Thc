'use strict';

(() => {
  const VERSION='seed-man-campaign-ui-v20';
  const TOTAL_LEVELS=20;
  const TOTAL_WORLDS=5;
  const TOTAL_BOSSES=6;
  const PROGRESS_KEYS=['dtf-seed-man-campaign-v20','dtf-seed-man-campaign-v3'];

  function completedCount(){
    const valid=new Set(window.__SPROUT_CAMPAIGN__?.listLevels?.().map((entry)=>entry.id)||[]);
    const completed=new Set();
    for(const key of PROGRESS_KEYS){try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');for(const id of Array.isArray(parsed.completed)?parsed.completed:[])if(valid.has(id))completed.add(id);}catch{}}
    return completed.size;
  }

  function normalize(){
    const kicker=document.querySelector('.seed-campaign-kicker');if(kicker)kicker.textContent=`${TOTAL_LEVELS}-LEVEL CAMPAIGN · ${TOTAL_WORLDS} WORLDS · ${TOTAL_BOSSES} BOSSES`;
    const title=document.querySelector('#seed-campaign-title');if(title)title.textContent=String(title.textContent||'').replace(/Level\s+(\d+)\s*\/\s*(?:11|15|20)/i,`Level $1 / ${TOTAL_LEVELS}`);
    const progress=document.querySelector('#seed-campaign-progress');if(progress)progress.textContent=`${completedCount()} / ${TOTAL_LEVELS} cleared`;
    const marker=document.querySelector('#seed-ui-release-marker');if(marker)marker.textContent='LIVE UI · 20 LEVELS · APPROVED ART · PHENOTYPE COMBAT';
    document.querySelectorAll('.feature-strip article strong').forEach((node)=>{if(/15\s*levels/i.test(node.textContent||''))node.textContent='20 levels';});
    document.documentElement.dataset.sproutCampaignLevels=String(TOTAL_LEVELS);
    document.documentElement.dataset.sproutCampaignUi=VERSION;
  }

  function install(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    if(!campaign||campaign.levelCount!==TOTAL_LEVELS){setTimeout(install,25);return;}
    const base=window.__SPROUT_CAMPAIGN_EXPERIENCE__||{};
    window.__SPROUT_CAMPAIGN_EXPERIENCE__=Object.freeze({...base,version:VERSION,baseVersion:base.version||null,levelCount:TOTAL_LEVELS,newLevelCount:19,bossCount:TOTAL_BOSSES,selectLevel:(id)=>{const selected=campaign.selectLevel(id);queueMicrotask(normalize);return selected;}});
    const select=document.querySelector('#seed-man-level-select');if(select)select.addEventListener('change',()=>requestAnimationFrame(normalize));
    const finish=document.querySelector('#finish-panel');if(finish)new MutationObserver(()=>queueMicrotask(normalize)).observe(finish,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
    normalize();
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
