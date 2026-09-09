'use strict';

(() => {
  const VERSION='seed-man-player-state-v20';
  const RETIRED_FIELDS=['speedTimer','jumpTimer','magnetTimer','shieldCharges'];
  const MOVEMENT_STATES=new Set(['idle','run','jump','double-jump','fall','hurt','finish']);
  let installed=false;

  function sanitize(next){
    if(!next||typeof next!=='object')return next;
    next.power=next.power&&typeof next.power==='object'?next.power:{};
    for(const key of RETIRED_FIELDS)delete next.power[key];
    delete next.collectedPowerups;
    next.power.invulnerableTimer=Math.max(0,Number(next.power.invulnerableTimer)||0);
    if(!MOVEMENT_STATES.has(next.state))next.state=next.finished?'finish':next.grounded?'idle':next.vy<0?'jump':'fall';
    return next;
  }

  function install(){
    if(typeof stepPlayer!=='function'||typeof reset!=='function')return false;
    const baseStep=stepPlayer;
    stepPlayer=function seedManPlayerStateV20Step(inputPlayer,inputState,levelData,dt,config){
      return sanitize(baseStep(sanitize(inputPlayer),inputState,levelData,dt,config));
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
    retiredFields:Object.freeze([...RETIRED_FIELDS]),
    sanitize,
    get installed(){return installed;},
    snapshot:()=>typeof player==='undefined'||!player?null:{
      state:player.state,
      grounded:Boolean(player.grounded),
      deaths:Number(player.deaths)||0,
      finished:Boolean(player.finished),
      invulnerableTimer:Number(player.power?.invulnerableTimer)||0,
      retiredFieldsPresent:RETIRED_FIELDS.filter((key)=>Object.hasOwn(player.power||{},key))
    }
  });
  boot();
})();
