'use strict';

(() => {
  const VERSION='seed-man-campaign-progression-v20';
  const PROGRESS_KEY='dtf-seed-man-campaign-v20';
  const ADVANCE_DELAY_MS=1800;
  let installed=false;
  let advancing=false;
  let observer=null;

  function campaign(){return window.__SPROUT_CAMPAIGN__;}
  function list(){return campaign()?.listLevels?.()||[];}
  function active(){return campaign()?.getLevel?.()||null;}

  function readProgress(){
    try {
      const parsed=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}');
      return {completed:Array.isArray(parsed.completed)?parsed.completed:[],lastLevel:parsed.lastLevel||null,updatedAt:parsed.updatedAt||null};
    } catch { return {completed:[],lastLevel:null,updatedAt:null}; }
  }

  function writeProgress(levelId,nextLevelId=null){
    const progress=readProgress();
    const completed=new Set(progress.completed);
    if(levelId)completed.add(levelId);
    const next={completed:[...completed],lastLevel:nextLevelId||levelId||progress.lastLevel,updatedAt:new Date().toISOString()};
    try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(next));}catch{}
    return next;
  }

  function setProgressText(){
    const node=document.querySelector('#seed-campaign-progress');
    if(!node)return;
    const valid=new Set(list().map((entry)=>entry.id));
    const count=readProgress().completed.filter((id)=>valid.has(id)).length;
    node.textContent=`${count} / 20 cleared`;
  }

  function nextEntry(entry){
    const levels=list();
    const index=levels.findIndex((candidate)=>candidate.id===entry?.id);
    return index>=0&&index<levels.length-1?levels[index+1]:null;
  }

  function updateFinishPanel(entry,next){
    const panel=document.querySelector('#finish-panel');
    const summary=document.querySelector('#finish-summary');
    const button=document.querySelector('#play-again');
    if(summary){
      const existing=summary.textContent||'';
      summary.textContent=next?`${existing} Next: Level ${next.order} · ${next.title}.`: `${existing} Campaign complete · the Last Seed is restored.`;
    }
    if(button){
      if(next){button.textContent=`Continue to Level ${next.order}`;button.dataset.seedNextLevel=next.id;}
      else{button.textContent='Replay Level 20';delete button.dataset.seedNextLevel;}
    }
    if(panel)panel.dataset.seedLevelComplete=entry?.id||'';
  }

  function completeAndAdvance(){
    if(advancing)return;
    const entry=active();
    if(!entry)return;
    const next=nextEntry(entry);
    writeProgress(entry.id,next?.id||entry.id);
    setProgressText();
    updateFinishPanel(entry,next);
    window.dispatchEvent(new CustomEvent('seedman:level-complete',{detail:{version:VERSION,level:{...entry},nextLevel:next?{...next}:null,campaignComplete:!next}}));
    if(!next)return;
    advancing=true;
    window.setTimeout(()=>{
      try{
        campaign()?.selectLevel?.(next.id);
        const select=document.querySelector('#seed-man-level-select');if(select)select.value=next.id;
        const finish=document.querySelector('#finish-panel');if(finish)finish.hidden=true;
        window.dispatchEvent(new CustomEvent('seedman:level-advanced',{detail:{version:VERSION,from:entry.id,to:next.id,order:next.order}}));
      } finally {advancing=false;setProgressText();}
    },ADVANCE_DELAY_MS);
  }

  function watchFinish(){
    const panel=document.querySelector('#finish-panel');
    if(!panel)return false;
    observer?.disconnect();
    observer=new MutationObserver(()=>{
      if(panel.hidden)return;
      queueMicrotask(completeAndAdvance);
    });
    observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
    return true;
  }

  function install(){
    if(installed)return;
    if(!campaign()||campaign().levelCount!==20){setTimeout(install,25);return;}
    if(!watchFinish()){setTimeout(install,25);return;}
    const again=document.querySelector('#play-again');
    if(again)again.addEventListener('click',(event)=>{
      const nextId=again.dataset.seedNextLevel;
      if(!nextId)return;
      event.preventDefault();event.stopImmediatePropagation();
      campaign()?.selectLevel?.(nextId);
      const select=document.querySelector('#seed-man-level-select');if(select)select.value=nextId;
      const finish=document.querySelector('#finish-panel');if(finish)finish.hidden=true;
    },true);
    window.addEventListener('sprout:level-selected',()=>{advancing=false;setProgressText();});
    installed=true;setProgressText();
    document.documentElement.dataset.seedManProgression=VERSION;
    window.__SEED_MAN_CAMPAIGN_PROGRESSION__=Object.freeze({version:VERSION,progressKey:PROGRESS_KEY,advanceDelayMs:ADVANCE_DELAY_MS,getProgress:readProgress,completeCurrentLevel:completeAndAdvance});
  }

  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
