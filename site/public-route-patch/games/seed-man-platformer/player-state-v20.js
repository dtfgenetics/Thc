'use strict';

(() => {
  const VERSION='seed-man-player-state-v20';
  const RETIRED_FIELDS=['speedTimer','jumpTimer','magnetTimer','shieldCharges'];
  const MOVEMENT_STATES=new Set(['idle','run','jump','double-jump','fall','hurt','finish']);
  const HEALTH_VERSION='seed-man-health-v1';
  const DEFAULT_MAX_HEALTH=3;
  let installed=false;

  function sanitize(next){
    if(!next||typeof next!=='object')return next;
    next.power=next.power&&typeof next.power==='object'?next.power:{};
    for(const key of RETIRED_FIELDS)delete next.power[key];
    delete next.collectedPowerups;
    next.power.invulnerableTimer=Math.max(0,Number(next.power.invulnerableTimer)||0);
    next.maxHealth=Math.max(1,Number(next.maxHealth)||DEFAULT_MAX_HEALTH);
    next.health=Number.isFinite(Number(next.health))?Math.max(0,Math.min(next.maxHealth,Number(next.health))):next.maxHealth;
    if(!MOVEMENT_STATES.has(next.state))next.state=next.finished?'finish':next.grounded?'idle':next.vy<0?'jump':'fall';
    return next;
  }

  function applyDamage(target,damage=1){
    const next=sanitize(target);
    if(!next||next.finished||next.power.invulnerableTimer>0)return {accepted:false,defeated:false,damage:0,health:next?.health??0};
    const amount=Math.max(1,Math.round(Number(damage)||1));
    next.health=Math.max(0,next.health-amount);
    return {accepted:true,defeated:next.health<=0,damage:amount,health:next.health};
  }

  function restoreHealth(target){
    const next=sanitize(target);
    if(next)next.health=next.maxHealth;
    return next;
  }

  function install(){
    if(typeof stepPlayer!=='function'||typeof reset!=='function')return false;
    const baseStep=stepPlayer;
    stepPlayer=function seedManPlayerStateV20Step(inputPlayer,inputState,levelData,dt,config){
      const prior=sanitize(inputPlayer);
      const priorDeaths=Number(prior?.deaths)||0;
      const next=sanitize(baseStep(prior,inputState,levelData,dt,config));
      if((Number(next?.deaths)||0)>priorDeaths)restoreHealth(next);
      return next;
    };
    const baseReset=reset;
    reset=function seedManPlayerStateV20Reset(){
      const result=baseReset();
      if(typeof player!=='undefined')sanitize(player);
      return result;
    };
    if(typeof player!=='undefined')sanitize(player);
    document.documentElement.dataset.seedManPlayerState=VERSION;
    installed=true;
    return true;
  }

  let attempts=0;
  function boot(){
    if(install())return;
    attempts+=1;
    if(attempts<120)setTimeout(boot,25);
  }

  window.__SEED_MAN_PLAYER_STATE__=Object.freeze({
    version:VERSION,
    healthVersion:HEALTH_VERSION,
    maxHealth:DEFAULT_MAX_HEALTH,
    retiredFields:Object.freeze([...RETIRED_FIELDS]),
    sanitize,
    applyDamage,
    restoreHealth,
    get installed(){return installed;},
    snapshot:()=>typeof player==='undefined'||!player?null:{
      state:player.state,
      grounded:Boolean(player.grounded),
      deaths:Number(player.deaths)||0,
      health:Number(player.health)||0,
      maxHealth:Number(player.maxHealth)||DEFAULT_MAX_HEALTH,
      finished:Boolean(player.finished),
      invulnerableTimer:Number(player.power?.invulnerableTimer)||0,
      retiredFieldsPresent:RETIRED_FIELDS.filter((key)=>Object.hasOwn(player.power||{},key))
    }
  });
  boot();
})();
