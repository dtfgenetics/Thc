'use strict';

(() => {
  const VERSION='seed-man-world-mechanics-browser-v1';
  const SOURCE_CONTRACT='seed-man-world-mechanics-runtime-v1';
  const RECIPE_URL='./data/authored-level-recipes-v1.json';
  const IMMUNITIES=Object.freeze({plant:[],fire:['lava'],electric:['electric-floor','energy-beam'],ice:['freeze-floor']});
  const HAZARDS=Object.freeze({
    spikes:{damage:1,mode:'contact'},'toxic-slime':{damage:1,mode:'contact'},'waterfall-gap':{damage:0,mode:'pit',respawn:true},
    'thorn-pits':{damage:1,mode:'contact'},'falling-bridges':{damage:0,mode:'breakaway'},'spore-cloud':{damage:1,mode:'zone'},
    'root-cage':{damage:1,mode:'trap'},lava:{damage:2,mode:'contact'},rockfall:{damage:2,mode:'cycle',cycleMs:2200,activeMs:700},
    'falling-rocks':{damage:1,mode:'cycle',cycleMs:1800,activeMs:650},sandstorm:{damage:0,mode:'force',forceX:-90,visibility:.72},
    'ice-spikes':{damage:1,mode:'contact'},'falling-icicles':{damage:2,mode:'cycle',cycleMs:2100,activeMs:650},
    'breakaway-ice':{damage:0,mode:'breakaway'},'freeze-floor':{damage:0,mode:'surface',friction:.22,accelerationMultiplier:.78},
    'electric-floor':{damage:1,mode:'cycle',cycleMs:1600,activeMs:800},'laser-grid':{damage:2,mode:'cycle',cycleMs:2000,activeMs:850},
    crusher:{damage:3,mode:'cycle',cycleMs:2600,activeMs:700},'energy-beam':{damage:2,mode:'cycle',cycleMs:1800,activeMs:600}
  });

  let recipeCatalog=null;
  let installed=false;
  let simTimeMs=0;
  let activeLevelId='';
  const preparedLevels=new WeakSet();
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const horizontal=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x;

  function hash01(value=''){
    let hash=2166136261;
    for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
    return((hash>>>0)%10000)/10000;
  }

  function currentPhenotype(){
    try{
      const snapshot=window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()||{};
      const form=snapshot.phenotypeForm||snapshot.activePhenotype||'plant';
      return['plant','fire','electric','ice'].includes(form)?form:'plant';
    }catch{return'plant'}
  }

  function hazardIsActive(type,timeMs=simTimeMs){
    const def=HAZARDS[type];
    if(!def||def.mode!=='cycle')return true;
    const cycle=Math.max(1,finite(def.cycleMs,1));
    return(((timeMs%cycle)+cycle)%cycle)<finite(def.activeMs,cycle);
  }

  function phenotypeImmuneToHazard(form,type){return(IMMUNITIES[form]||IMMUNITIES.plant).includes(type)}
  function zoneForX(levelData,x){return(levelData?.encounterZones||[]).find(zone=>x>=finite(zone.startX,-Infinity)&&x<=finite(zone.endX,Infinity))||null}
  function mechanicsAtX(levelData,x){
    const zone=zoneForX(levelData,x);
    const values=Array.isArray(zone?.mechanics)&&zone.mechanics.length?zone.mechanics:(levelData?.mechanics||[]);
    return[...new Set(values.filter(Boolean))];
  }
  function platformInZone(platform,zone){const center=finite(platform.x)+finite(platform.width)/2;return center>=finite(zone.startX,-Infinity)&&center<=finite(zone.endX,Infinity)}

  function decorateZonePlatforms(levelData,zone,section){
    const mechanics=new Set(zone.mechanics||[]);
    const zonePlatforms=(levelData.platforms||[]).filter(platform=>platformInZone(platform,zone));
    const ground=zonePlatforms.find(platform=>String(platform.id||'').endsWith('-ground'))||zonePlatforms.find(platform=>platform.y>=450);
    if(ground&&mechanics.has('slippery-ground'))ground.slippery=true;
    const needsTraversal=[...mechanics].some(name=>['moving-platforms','vertical-platforms','vine-platforms','wall-routes','crystal-bounce','conveyor-platforms','collapsing-platforms','springs'].includes(name));
    let traversal=zonePlatforms.filter(platform=>platform!==ground&&platform.y<450);
    if(needsTraversal&&traversal.length===0&&(mechanics.has('collapsing-platforms')||mechanics.has('springs'))){
      const usableWidth=Math.max(280,finite(zone.endX)-finite(zone.startX));
      const count=mechanics.has('vertical-platforms')?4:3;
      const surface=section?.surface||zone.surface||ground?.surface||'grass';
      for(let p=0;p<count;p+=1){
        const travel=Math.max(0,usableWidth-440);
        const platform={id:`${zone.id}-runtime-platform-${p+1}`,x:finite(zone.startX)+220+p*(travel/Math.max(1,count-1)),y:380-(p%2)*70,width:180,height:22,surface:mechanics.has('crystal-bounce')?'ice':surface};
        levelData.platforms.push(platform);traversal.push(platform);
      }
    }
    traversal.forEach((platform,p)=>{
      if(mechanics.has('moving-platforms')&&!platform.motion)platform.motion={axis:p%2?'y':'x',distance:110,durationMs:2200};
      if(mechanics.has('conveyor-platforms')&&!platform.conveyor)platform.conveyor={speed:p%2?-55:55};
      if(mechanics.has('springs'))platform.bounce={multiplier:1.18};
      if(mechanics.has('crystal-bounce'))platform.bounce={multiplier:1.28};
      if(mechanics.has('collapsing-platforms'))platform.breakaway={cycleMs:2600,activeMs:1550,phaseMs:p*320};
      platform.zoneId=zone.id;
    });
  }

  function enrichLevel(levelData){
    if(!levelData||preparedLevels.has(levelData))return levelData;
    if(!recipeCatalog)return levelData;
    const recipe=recipeCatalog.levels?.[levelData.id]||null;
    const zones=levelData.encounterZones||[];
    if(recipe?.sections?.length===zones.length){
      zones.forEach((zone,index)=>{
        const section=recipe.sections[index]||{};
        zone.surface=section.surface||zone.surface||'grass';
        zone.mechanics=[...(section.mechanics||[])];
        zone.hazards=[...(section.hazards||[])];
        decorateZonePlatforms(levelData,zone,section);
      });
    }
    for(const platform of levelData.platforms||[]){
      platform.__seedBaseX=finite(platform.x);platform.__seedBaseY=finite(platform.y);platform.__seedPrevX=finite(platform.x);platform.__seedPrevY=finite(platform.y);
    }
    preparedLevels.add(levelData);
    return levelData;
  }

  function platformActive(platform,timeMs=simTimeMs){
    const rule=platform?.breakaway;
    if(!rule)return true;
    const cycle=Math.max(1,finite(rule.cycleMs,2600)),active=Math.max(1,Math.min(cycle,finite(rule.activeMs,1550))),phase=finite(rule.phaseMs,hash01(platform.id)*cycle);
    return((((timeMs+phase)%cycle)+cycle)%cycle)<active;
  }

  function updateDynamicPlatforms(levelData,timeMs=simTimeMs){
    for(const platform of levelData?.platforms||[]){
      if(platform.__seedBaseX==null){platform.__seedBaseX=finite(platform.x);platform.__seedBaseY=finite(platform.y)}
      platform.__seedPrevX=finite(platform.x);platform.__seedPrevY=finite(platform.y);
      if(platform.motion){
        const duration=Math.max(240,finite(platform.motion.durationMs,2200)),distance=finite(platform.motion.distance),phase=hash01(platform.id)*Math.PI*2,offset=Math.sin((timeMs/duration)*Math.PI*2+phase)*distance;
        if(platform.motion.axis==='y'){platform.x=platform.__seedBaseX;platform.y=platform.__seedBaseY+offset}else{platform.x=platform.__seedBaseX+offset;platform.y=platform.__seedBaseY}
      }
      platform.__runtimeHidden=!platformActive(platform,timeMs);
    }
  }

  function standingOn(playerState,platform,usePrevious=false,tolerance=7){
    if(!playerState||!platform)return false;
    const px=usePrevious?finite(platform.__seedPrevX,platform.x):finite(platform.x),py=usePrevious?finite(platform.__seedPrevY,platform.y):finite(platform.y);
    const proxy={x:px,y:py,width:finite(platform.width),height:finite(platform.height)},feet=finite(playerState.y)+finite(playerState.height);
    return horizontal(playerState,proxy)&&Math.abs(feet-proxy.y)<=tolerance;
  }

  function carryWithPlatform(inputPlayer,levelData){
    const carried={...inputPlayer};
    for(const platform of levelData?.platforms||[]){
      if(platform.__runtimeHidden||!platform.motion||!standingOn(inputPlayer,platform,true,8))continue;
      carried.x=finite(carried.x)+(finite(platform.x)-finite(platform.__seedPrevX,platform.x));
      carried.y=finite(carried.y)+(finite(platform.y)-finite(platform.__seedPrevY,platform.y));break;
    }
    return carried;
  }

  function activePlatforms(levelData){return(levelData?.platforms||[]).filter(platform=>platform.__runtimeHidden!==true)}
  function activeLethalHazards(levelData,form){
    return(levelData?.hazards||[]).filter(hazard=>{
      const def=HAZARDS[hazard.type];
      if(!def)return true;
      if(!hazardIsActive(hazard.type)||phenotypeImmuneToHazard(form,hazard.type))return false;
      return def.damage>0||def.respawn||def.mode==='trap';
    });
  }

  function applyEnvironment(next,prior,inputState,levelData,form,dt){
    const step=clamp(finite(dt),0,.05),centerX=finite(next.x)+finite(next.width)/2,mechanics=new Set(mechanicsAtX(levelData,centerX));
    const support=(levelData.platforms||[]).find(platform=>platform.__runtimeHidden!==true&&standingOn(next,platform,false,9));
    if(next.grounded&&support?.conveyor?.speed)next.x+=finite(support.conveyor.speed)*step;
    if(next.grounded&&support?.bounce?.multiplier){next.vy=-620*Math.max(1,finite(support.bounce.multiplier,1));next.grounded=false;next.state='jump'}
    if(next.grounded&&(support?.slippery||support?.surface==='ice'||mechanics.has('slippery-ground'))&&!inputState?.left&&!inputState?.right&&Math.abs(finite(prior?.vx))>8)next.vx=finite(prior.vx)*.975;
    if(mechanics.has('wind-zones'))next.vx+=(-78+Math.sin(simTimeMs/620)*52)*step;
    if(mechanics.has('heat-updraft')&&!next.grounded){next.vy-=110*step;next.vy*=Math.pow(.62,step)}
    let visibility=mechanics.has('dark-zones')?.55:1;
    for(const hazard of levelData?.hazards||[]){
      const def=HAZARDS[hazard.type];if(!def||!hazardIsActive(hazard.type)||phenotypeImmuneToHazard(form,hazard.type))continue;
      if(def.mode==='force'&&horizontal(next,hazard)){next.vx+=finite(def.forceX)*step;visibility=Math.min(visibility,finite(def.visibility,1))}
      if(def.mode==='surface'&&horizontal(next,hazard)){const feet=finite(next.y)+finite(next.height);if(feet>=finite(hazard.y)-28&&!inputState?.left&&!inputState?.right)next.vx=finite(prior?.vx,next.vx)*finite(def.friction,.22)}
    }
    next.worldVisibility=visibility;
    next.x=clamp(finite(next.x),0,Math.max(0,finite(levelData.worldWidth)-finite(next.width)));
    return next;
  }

  function installPhysics(){
    if(installed||typeof stepPlayer!=='function')return false;
    const baseStep=stepPlayer;
    stepPlayer=function seedManWorldMechanicsStep(inputPlayer,inputState,levelData,dt,config){
      if(!levelData)return baseStep(inputPlayer,inputState,levelData,dt,config);
      if(levelData.id!==activeLevelId){activeLevelId=levelData.id||'';simTimeMs=0}
      simTimeMs+=clamp(finite(dt),0,.05)*1000;
      enrichLevel(levelData);updateDynamicPlatforms(levelData,simTimeMs);
      const form=currentPhenotype(),carried=carryWithPlatform(inputPlayer,levelData),frameLevel={...levelData,platforms:activePlatforms(levelData),hazards:activeLethalHazards(levelData,form)};
      const next=baseStep(carried,inputState,frameLevel,dt,config);
      return applyEnvironment(next,carried,inputState,levelData,form,dt);
    };
    installed=true;return true;
  }

  function installCanvasRendering(){
    if(typeof drawPlatforms!=='function'||typeof ctx==='undefined')return false;
    drawPlatforms=function seedManWorldMechanicsDrawPlatforms(){
      const [, , top, base]=fallbackPalette(),form=currentPhenotype();
      for(const platform of activePlatforms(level)){
        worldRect(platform,base,'#17321f');ctx.fillStyle=platform.surface==='ice'?'#b9efff':top;ctx.fillRect(Math.round(platform.x-cameraX),platform.y,platform.width,Math.min(7,platform.height));
        if(platform.conveyor?.speed){ctx.strokeStyle='#d8efe0';ctx.lineWidth=2;const direction=platform.conveyor.speed>0?1:-1;for(let px=Math.round(platform.x-cameraX)+18;px<platform.x-cameraX+platform.width-14;px+=34){ctx.beginPath();ctx.moveTo(px-7*direction,platform.y+14);ctx.lineTo(px+7*direction,platform.y+14);ctx.lineTo(px+2*direction,platform.y+9);ctx.moveTo(px+7*direction,platform.y+14);ctx.lineTo(px+2*direction,platform.y+19);ctx.stroke()}}
      }
      for(const hazard of level?.hazards||[]){
        const active=hazardIsActive(hazard.type)&&!phenotypeImmuneToHazard(form,hazard.type),x=Math.round(hazard.x-cameraX);ctx.save();ctx.globalAlpha=active?1:.38;ctx.fillStyle=active?'#542d2d':'#3b413e';ctx.fillRect(x,hazard.y,hazard.width,hazard.height);ctx.fillStyle=active?'#ff865f':'#8a8f8d';for(let px=x;px<x+hazard.width;px+=24){ctx.beginPath();ctx.moveTo(px,hazard.y+12);ctx.lineTo(px+12,hazard.y-10);ctx.lineTo(px+24,hazard.y+12);ctx.fill()}ctx.restore();
      }
    };
    return true;
  }

  async function loadRecipes(){
    try{
      const response=await fetch(RECIPE_URL,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);recipeCatalog=await response.json();document.documentElement.dataset.seedManWorldMechanicsRecipes='ready';
      try{if(typeof level!=='undefined'&&level)enrichLevel(level)}catch{}
    }catch(error){document.documentElement.dataset.seedManWorldMechanicsRecipes='degraded';console.error('[Seed Man] world mechanics recipe enrichment failed.',error)}
  }

  const physicsInstalled=installPhysics();
  const canvasInstalled=installCanvasRendering();
  document.documentElement.dataset.seedManWorldMechanics=VERSION;
  window.__SEED_MAN_WORLD_MECHANICS__=Object.freeze({version:VERSION,sourceContract:SOURCE_CONTRACT,installed:()=>installed,physicsInstalled,canvasInstalled,phenotypeImmuneToHazard,hazardIsActive,mechanicsAtX,snapshot:()=>Object.freeze({version:VERSION,installed,recipesReady:Boolean(recipeCatalog),activeLevelId,simTimeMs,phenotype:currentPhenotype()})});
  loadRecipes();
  window.addEventListener('sprout:level-selected',()=>{activeLevelId='';simTimeMs=0;try{if(typeof level!=='undefined'&&level)enrichLevel(level)}catch{}});
  window.dispatchEvent(new CustomEvent('seedman:world-mechanics-ready',{detail:{version:VERSION,physicsInstalled,canvasInstalled}}));
})();
