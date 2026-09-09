'use strict';

(() => {
  const VERSION='seed-man-campaign-progress-v20-v1';
  const KEY='dtf-seed-man-campaign-v20';
  let installed=false;
  let originalStep=null;

  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {completed:Array.isArray(value.completed)?value.completed:[],lastLevel:value.lastLevel||null,updatedAt:value.updatedAt||null};
    }catch{return {completed:[],lastLevel:null,updatedAt:null};}
  }

  function write(levelId){
    const state=read();
    if(!state.completed.includes(levelId)) state.completed.push(levelId);
    state.lastLevel=levelId;
    state.updatedAt=new Date().toISOString();
    try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
    window.dispatchEvent(new CustomEvent('seedman:campaign-progress',{detail:{...state,completedCount:state.completed.length}}));
    return state;
  }

  function nextEntry(id){
    const levels=window.__SPROUT_CAMPAIGN__?.listLevels?.()||[];
    const index=levels.findIndex(entry=>entry.id===id);
    return index>=0&&index<levels.length-1?levels[index+1]:null;
  }

  function installNextButton(){
    const panel=document.querySelector('#finish-panel');
    if(!panel||panel.querySelector('[data-seed-next-level]'))return;
    const button=document.createElement('button');
    button.type='button';button.className='primary';button.dataset.seedNextLevel='1';button.textContent='Next level';
    button.addEventListener('click',()=>{
      const active=window.__SPROUT_CAMPAIGN__?.activeLevelId;
      const next=nextEntry(active);
      if(next){window.__SPROUT_CAMPAIGN__.selectLevel(next.id);panel.hidden=true;}
      else{button.textContent='Campaign complete';button.disabled=true;}
    });
    panel.append(button);
  }

  function onComplete(levelId){
    const state=write(levelId);
    installNextButton();
    const button=document.querySelector('[data-seed-next-level]');
    const next=nextEntry(levelId);
    if(button){button.disabled=!next;button.textContent=next?`Next: ${next.title}`:'Campaign complete';}
    const progress=document.querySelector('#seed-campaign-progress');
    if(progress)progress.textContent=`${state.completed.length} / 20 cleared`;
  }

  function install(){
    if(installed)return;
    if(!window.__SEED_MAN_CAMPAIGN_V20__||!window.__SEED_MAN_CAMPAIGN_COMBAT_V20__||typeof stepPlayer!=='function'){setTimeout(install,50);return;}
    installed=true;
    originalStep=stepPlayer;
    stepPlayer=function seedManCampaignProgressStep(inputPlayer,inputState,levelData,dt,config=DEFAULTS){
      const wasFinished=Boolean(inputPlayer?.finished);
      const next=originalStep(inputPlayer,inputState,levelData,dt,config);
      if(!wasFinished&&next?.finished&&levelData?.id) queueMicrotask(()=>onComplete(levelData.id));
      return next;
    };
    installNextButton();
    document.documentElement.dataset.seedManCampaignProgress=VERSION;
    window.__SEED_MAN_CAMPAIGN_PROGRESS_V20__=Object.freeze({version:VERSION,key:KEY,read});
  }

  if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
