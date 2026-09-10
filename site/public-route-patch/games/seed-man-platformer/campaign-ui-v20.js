'use strict';

(() => {
  const VERSION='seed-man-campaign-ui-v20';
  const TOTAL_LEVELS=20;
  const TOTAL_WORLDS=5;
  const TOTAL_BOSSES=6;
  const LEVEL_SELECT_ID='campaign-level-select-v20';
  const PROGRESS_KEYS=['dtf-seed-man-campaign-v20','dtf-seed-man-campaign-v3'];
  const ACTIVE_PROGRESS_KEY=PROGRESS_KEYS[0];
  const NEXT_LEVEL_DELAY_MS=1100;
  let advanceTimer=null;
  let transitionFromLevel=null;

  function completedCount(){
    const valid=new Set(window.__SPROUT_CAMPAIGN__?.listLevels?.().map((entry)=>entry.id)||[]);
    const completed=new Set();
    for(const key of PROGRESS_KEYS){try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');for(const id of Array.isArray(parsed.completed)?parsed.completed:[])if(valid.has(id))completed.add(id);}catch{}}
    return completed.size;
  }

  function markCompleted(levelId){
    if(!levelId)return;
    try{
      const parsed=JSON.parse(localStorage.getItem(ACTIVE_PROGRESS_KEY)||'{}');
      const completed=new Set(Array.isArray(parsed.completed)?parsed.completed:[]);
      completed.add(levelId);
      localStorage.setItem(ACTIVE_PROGRESS_KEY,JSON.stringify({...parsed,version:20,completed:[...completed]}));
    }catch(error){
      console.warn('[Seed Man] campaign completion could not be persisted.',error);
    }
  }

  function getNextLevelId(levelId){
    const campaign=window.__SPROUT_CAMPAIGN__;
    const levels=campaign?.listLevels?.()||[];
    const index=levels.findIndex((entry)=>entry.id===levelId);
    return index>=0&&index<levels.length-1?levels[index+1].id:null;
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

  function clearAdvance(){
    if(advanceTimer!==null){clearTimeout(advanceTimer);advanceTimer=null;}
  }

  function handleFinish(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    const finish=document.querySelector('#finish-panel');
    if(!campaign||!finish||finish.hidden)return;
    const completedId=campaign.activeLevelId;
    if(!completedId||transitionFromLevel===completedId)return;

    transitionFromLevel=completedId;
    markCompleted(completedId);
    normalize();

    const nextId=getNextLevelId(completedId);
    const summary=document.querySelector('#finish-summary');
    if(!nextId){
      clearAdvance();
      if(summary)summary.textContent=`${summary.textContent||''} Campaign complete — all ${TOTAL_LEVELS} levels cleared.`.trim();
      document.documentElement.dataset.seedManCampaignComplete='true';
      window.dispatchEvent(new CustomEvent('seedman:campaign-complete',{detail:{levelId:completedId,levelCount:TOTAL_LEVELS}}));
      return;
    }

    const next=campaign.getLevel?.(nextId);
    const status=document.querySelector('#load-status');
    if(status)status.textContent=`Level cleared · loading Level ${next?.order||''}${next?.title?` — ${next.title}`:''}…`;
    if(summary)summary.textContent=`${summary.textContent||''} Next: ${next?.title||nextId}.`.trim();

    clearAdvance();
    advanceTimer=setTimeout(()=>{
      advanceTimer=null;
      if(window.__SPROUT_CAMPAIGN__?.activeLevelId!==completedId)return;
      try{
        campaign.selectLevel(nextId);
        const select=document.getElementById(LEVEL_SELECT_ID);if(select)select.value=nextId;
        window.dispatchEvent(new CustomEvent('seedman:level-advanced',{detail:{from:completedId,to:nextId}}));
      }catch(error){
        console.error('[Seed Man] next level failed to load.',error);
        transitionFromLevel=null;
        const retry=document.querySelector('#load-status');if(retry)retry.textContent='Level cleared, but the next level could not load. Choose it from Level Select to continue.';
      }
    },NEXT_LEVEL_DELAY_MS);
  }

  function install(){
    const campaign=window.__SPROUT_CAMPAIGN__;
    if(!campaign||campaign.levelCount!==TOTAL_LEVELS){setTimeout(install,25);return;}
    const base=window.__SPROUT_CAMPAIGN_EXPERIENCE__||{};
    window.__SPROUT_CAMPAIGN_EXPERIENCE__=Object.freeze({...base,version:VERSION,baseVersion:base.version||null,levelCount:TOTAL_LEVELS,newLevelCount:19,bossCount:TOTAL_BOSSES,selectLevel:(id)=>{clearAdvance();transitionFromLevel=null;const selected=campaign.selectLevel(id);queueMicrotask(normalize);return selected;}});
    const select=document.getElementById(LEVEL_SELECT_ID);if(select)select.addEventListener('change',()=>requestAnimationFrame(normalize));
    const finish=document.querySelector('#finish-panel');if(finish)new MutationObserver(()=>{queueMicrotask(normalize);queueMicrotask(handleFinish);}).observe(finish,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
    window.addEventListener('sprout:level-selected',()=>{clearAdvance();transitionFromLevel=null;queueMicrotask(normalize);});
    normalize();
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
