'use strict';

(() => {
  const VERSION='seed-man-world-mechanics-browser-v1';
  const HAZARDS=Object.freeze({
    'spikes':{damage:1,mode:'contact'},'toxic-slime':{damage:1,mode:'contact'},'waterfall-gap':{damage:0,mode:'pit',respawn:true},
    'thorn-pits':{damage:1,mode:'contact'},'falling-bridges':{damage:0,mode:'breakaway'},'spore-cloud':{damage:1,mode:'zone'},
    'root-cage':{damage:1,mode:'trap'},'lava':{damage:2,mode:'contact'},'rockfall':{damage:2,mode:'cycle',cycleMs:2200,activeMs:700},
    'falling-rocks':{damage:1,mode:'cycle',cycleMs:1800,activeMs:650},'sandstorm':{damage:0,mode:'force',forceX:-90,visibility:.72},
    'ice-spikes':{damage:1,mode:'contact'},'falling-icicles':{damage:2,mode:'cycle',cycleMs:2100,activeMs:650},
    'breakaway-ice':{damage:0,mode:'breakaway'},'freeze-floor':{damage:0,mode:'surface',friction:.22,accelerationMultiplier:.78},
    'electric-floor':{damage:1,mode:'cycle',cycleMs:1600,activeMs:800},'laser-grid':{damage:2,mode:'cycle',cycleMs:2000,activeMs:850},
    'crusher':{damage:3,mode:'cycle',cycleMs:2600,activeMs:700},'energy-beam':{damage:2,mode:'cycle',cycleMs:1800,activeMs:600}
  });
  const IMMUNITIES=Object.freeze({plant:[],fire:['lava'],electric:['electric-floor','energy-beam'],ice:['freeze-floor']});
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const horizontal=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x;
  const phenotype=()=>{try{return window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.phenotypeForm||'plant'}catch{return'plant'}};
  const elapsedMs=()=>{try{return Math.max(0,finite(elapsed)*1000)}catch{return performance.now()}};

  function hash01(value=''){
    let hash=2166136261;
    for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
    return ((hash>>>0)%10000)/10000;
  }

  function mechanicsAtX(levelData,x){
    const zones=Array.isArray(levelData?.encounterZones)?levelData.encounterZones:[];
    const zone=zones.find(entry=>x>=finite(entry.startX,-Infinity)&&x<=finite(entry.endX,Infinity));
    const values=zone?.mechanics?.length?zone.mechanics:(levelData?.mechanics||[]);
    return [...new Set(values.filter(Boolean))];
  }

  function immune(form,type){return (IMMUNITIES[form]||IMMUNITIES.plant).includes(type)}
  function hazardActive(type,timeMs){const def=HAZARDS[type];if(!def||def.mode!=='cycle')return true;return ((timeMs%def.cycleMs)+def.cycleMs)%def.cycleMs<def.activeMs}

  function platformActive(platform,levelData,timeMs){
    if(platform?.breakaway){
      const cycle=Math.max(1,finite(platform.breakaway.cycleMs,2600));
      const active=Math.max(1,Math.min(cycle,finite(platform.breakaway.activeMs,1550)));
      const phase=finite(platform.breakaway.phaseMs,hash01(platform.id)*cycle);
      return (((timeMs+phase)%cycle)+cycle)%cycle<active;
    }
    const mechanics=mechanicsAtX(levelData,finite(platform?.x));
    const candidate=mechanics.includes('collapsing-platforms')&&finite(platform?.height,60)<=30&&finite(platform?.y,480)<450;
    if(!candidate)return true;
    const phase=hash01(platform?.id||`${platform?.x}:${platform?.y}`)*2600;
    return (((timeMs+phase)%2600)+2600)%2600<1550;
  }

  function resolvePlatform(platform,levelData,timeMs){
    if(!platformActive(platform,levelData,timeMs))return null;
    const next={...platform};
    if(platform?.motion){
      const duration=Math.max(240,finite(platform.motion.durationMs,2200));
      const offset=Math.sin((timeMs/duration)*Math.PI*2+hash01(platform.id)*Math.PI*2)*finite(platform.motion.distance);
      if(platform.motion.axis==='y')next.y=finite(platform.y)+offset;else next.x=finite(platform.x)+offset;
    }
    return next;
  }

  function resolvePlatforms(levelData,timeMs){return(levelData?.platforms||[]).map(item=>resolvePlatform(item,levelData,timeMs)).filter(Boolean)}
  function platformDelta(levelData,id,timeMs,dt){
    if(!id)return{x:0,y:0};
    const source=(levelData?.platforms||[]).find(item=>item.id===id);if(!source)return{x:0,y:0};
    const current=resolvePlatform(source,levelData,timeMs),previous=resolvePlatform(source,levelData,Math.max(0,timeMs-dt*1000));
    return current&&previous?{x:finite(current.x)-finite(previous.x),y:finite(current.y)-finite(previous.y)}:{x:0,y:0};
  }

  function activeHazards(levelData,timeMs,form){
    return(levelData?.hazards||[]).filter(hazard=>{
      const def=HAZARDS[hazard.type];
      return Boolean(def&&hazardActive(hazard.type,timeMs)&&!immune(form,hazard.type)&&(def.damage>0||def.respawn||def.mode==='trap'));
    });
  }

  function effectsAt(levelData,target,timeMs,form){
    const mechanics=mechanicsAtX(levelData,finite(target?.x)+finite(target?.width)/2);
    const effects={forceX:0,lift:0,gravity:1,friction:1,acceleration:1,visibility:1,conveyor:0,bounce:0,mechanics};
    if(mechanics.includes('wind-zones'))effects.forceX+=-78+Math.sin(timeMs/620)*52;
    if(mechanics.includes('heat-updraft')){effects.gravity=.62;effects.lift=110}
    if(mechanics.includes('slippery-ground')){effects.friction=.24;effects.acceleration=.8}
    if(mechanics.includes('dark-zones'))effects.visibility=.55;
    if(mechanics.includes('springs'))effects.bounce=Math.max(effects.bounce,1.18);
    if(mechanics.includes('crystal-bounce'))effects.bounce=Math.max(effects.bounce,1.28);
    for(const hazard of levelData?.hazards||[]){
      const def=HAZARDS[hazard.type];if(!def||!hazardActive(hazard.type,timeMs)||immune(form,hazard.type))continue;
      const across=horizontal(target,hazard),feet=finite(target?.y)+finite(target?.height);
      if(def.mode==='force'&&across)effects.forceX+=finite(def.forceX);
      if(def.mode==='surface'&&across&&feet>=finite(hazard.y)-28){effects.friction=Math.min(effects.friction,finite(def.friction,1));effects.acceleration=Math.min(effects.acceleration,finite(def.accelerationMultiplier,1))}
      if(def.visibility&&across)effects.visibility=Math.min(effects.visibility,def.visibility);
    }
    const platforms=resolvePlatforms(levelData,timeMs),feet=finite(target?.y)+finite(target?.height);
    const support=platforms.find(item=>horizontal(target,item)&&Math.abs(feet-finite(item.y))<=5);
    if(support?.surface==='ice'||support?.slippery){effects.friction=Math.min(effects.friction,.28);effects.acceleration=Math.min(effects.acceleration,.82)}
    if(support?.conveyor?.speed)effects.conveyor=finite(support.conveyor.speed);
    if(support?.bounce?.multiplier)effects.bounce=Math.max(effects.bounce,finite(support.bounce.multiplier));
    return effects;
  }

  function frameLevel(levelData,timeMs,form){return{...levelData,platforms:resolvePlatforms(levelData,timeMs),hazards:activeHazards(levelData,timeMs,form),activePhenotype:form,runtimeTimeMs:timeMs}}

  const baseStep=typeof stepPlayer==='function'?stepPlayer:null;
  if(baseStep){
    stepPlayer=function seedManWorldMechanicsStep(inputPlayer,input,levelData,dt,config=DEFAULTS){
      const timeMs=elapsedMs(),form=phenotype(),step=Math.min(Math.max(finite(dt),0),.05),pre={...inputPlayer};
      const carry=platformDelta(levelData,pre.groundPlatformId,timeMs,step);pre.x=finite(pre.x)+carry.x;pre.y=finite(pre.y)+carry.y;
      const effects=effectsAt(levelData,pre,timeMs,form);pre.vx=finite(pre.vx)+(effects.forceX+effects.conveyor)*step;if(!pre.grounded)pre.vy=finite(pre.vy)-effects.lift*step;
      const tuned={...config,gravity:finite(config.gravity,DEFAULTS.gravity)*effects.gravity,groundAcceleration:finite(config.groundAcceleration,DEFAULTS.groundAcceleration)*effects.acceleration,groundDeceleration:finite(config.groundDeceleration,DEFAULTS.groundDeceleration)*effects.friction,airAcceleration:finite(config.airAcceleration,DEFAULTS.airAcceleration)*effects.acceleration};
      const runtime=frameLevel(levelData,timeMs,form);let next=baseStep(pre,input,runtime,step,tuned);
      const feet=finite(next.y)+finite(next.height),support=(runtime.platforms||[]).find(item=>horizontal(next,item)&&Math.abs(feet-finite(item.y))<=5);
      next.groundPlatformId=next.grounded?(support?.id||null):null;
      const bounce=support?.bounce?.multiplier||((support&&finite(support.height,60)<=30)?effects.bounce:0);
      if(next.grounded&&bounce>1){next.vy=-DEFAULTS.jumpSpeed*bounce;next.grounded=false;next.state='jump';next.airJumpsRemaining=DEFAULTS.maxAirJumps}
      next.worldVisibility=effects.visibility;
      return next;
    };
  }

  const baseDraw=typeof drawPlatforms==='function'?drawPlatforms:null;
  if(baseDraw&&typeof ctx!=='undefined'){
    drawPlatforms=function seedManWorldMechanicsDraw(){
      const [, , top, base]=fallbackPalette(),timeMs=elapsedMs(),form=phenotype();
      for(const platform of resolvePlatforms(level,timeMs)){
        worldRect(platform,base,'#17321f');ctx.fillStyle=platform.surface==='ice'?'#b9efff':top;ctx.fillRect(Math.round(platform.x-cameraX),platform.y,platform.width,Math.min(7,platform.height));
        if(platform.conveyor?.speed){ctx.strokeStyle='#d8efe0';ctx.lineWidth=2;const direction=platform.conveyor.speed>0?1:-1;for(let px=Math.round(platform.x-cameraX)+18;px<platform.x-cameraX+platform.width-14;px+=34){ctx.beginPath();ctx.moveTo(px-7*direction,platform.y+14);ctx.lineTo(px+7*direction,platform.y+14);ctx.lineTo(px+2*direction,platform.y+9);ctx.moveTo(px+7*direction,platform.y+14);ctx.lineTo(px+2*direction,platform.y+19);ctx.stroke()}}
      }
      for(const hazard of level?.hazards||[]){
        const active=hazardActive(hazard.type,timeMs)&&!immune(form,hazard.type),x=Math.round(hazard.x-cameraX);ctx.save();ctx.globalAlpha=active?1:.38;ctx.fillStyle=active?'#542d2d':'#3b413e';ctx.fillRect(x,hazard.y,hazard.width,hazard.height);ctx.fillStyle=active?'#ff865f':'#8a8f8d';for(let px=x;px<x+hazard.width;px+=24){ctx.beginPath();ctx.moveTo(px,hazard.y+12);ctx.lineTo(px+12,hazard.y-10);ctx.lineTo(px+24,hazard.y+12);ctx.fill()}ctx.restore();
      }
    };
  }

  const baseRender=typeof render==='function'?render:null;
  if(baseRender){
    render=function seedManWorldMechanicsRender(){
      baseRender();
      let visibility=1;try{visibility=Math.max(.35,Math.min(1,finite(player?.worldVisibility,1)))}catch{}
      if(visibility<.995&&typeof ctx!=='undefined'&&ctx&&typeof canvas!=='undefined'&&canvas){ctx.save();ctx.fillStyle=`rgba(4,10,8,${(1-visibility)*.82})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore()}
    };
  }

  window.__SEED_MAN_WORLD_MECHANICS__=Object.freeze({version:VERSION,installed:Boolean(baseStep),hazardCount:Object.keys(HAZARDS).length,resolvePlatforms,frameLevel,mechanicsAtX,phenotypeImmuneToHazard:immune,snapshot:()=>({version:VERSION,installed:Boolean(baseStep),phenotype:phenotype()})});
  document.documentElement.dataset.seedManWorldMechanics=VERSION;
})();
