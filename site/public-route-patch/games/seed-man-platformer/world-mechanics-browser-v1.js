'use strict';

(() => {
  const VERSION = 'seed-man-world-mechanics-browser-v3';
  const SOURCE_CONTRACT = 'seed-man-world-mechanics-runtime-v1';
  const RECIPE_URL = './data/authored-level-recipes-v1.json';
  const PHENOTYPE_HAZARD_IMMUNITIES = Object.freeze({
    plant: Object.freeze([]),
    fire: Object.freeze(['lava']),
    electric: Object.freeze(['electric-floor','energy-beam']),
    ice: Object.freeze(['freeze-floor'])
  });
  const HAZARD_DEFS = Object.freeze({
    spikes:{damage:1,mode:'contact'},
    'toxic-slime':{damage:1,mode:'contact'},
    'waterfall-gap':{damage:0,mode:'pit',respawn:true},
    'thorn-pits':{damage:1,mode:'contact'},
    'falling-bridges':{damage:0,mode:'breakaway'},
    'spore-cloud':{damage:1,mode:'zone'},
    'root-cage':{damage:1,mode:'trap'},
    lava:{damage:2,mode:'contact'},
    rockfall:{damage:2,mode:'cycle',cycleMs:2200,activeMs:700},
    'falling-rocks':{damage:1,mode:'cycle',cycleMs:1800,activeMs:650},
    sandstorm:{damage:0,mode:'force',forceX:-90,visibility:.72},
    'ice-spikes':{damage:1,mode:'contact'},
    'falling-icicles':{damage:2,mode:'cycle',cycleMs:2100,activeMs:650},
    'breakaway-ice':{damage:0,mode:'breakaway'},
    'freeze-floor':{damage:0,mode:'surface',friction:.22,accelerationMultiplier:.78},
    'electric-floor':{damage:1,mode:'cycle',cycleMs:1600,activeMs:800},
    'laser-grid':{damage:2,mode:'cycle',cycleMs:2000,activeMs:850},
    crusher:{damage:3,mode:'cycle',cycleMs:2600,activeMs:700},
    'energy-beam':{damage:2,mode:'cycle',cycleMs:1800,activeMs:600}
  });

  let recipeCatalog = null;
  let installed = false;
  let elapsedMs = 0;
  let activeLevelId = '';
  let teleportCooldownMs = 0;
  let lastTeleportEvent = null;
  let arenaLockEngaged = false;
  let arenaLockZoneId = '';
  const preparedLevels = new WeakSet();
  const TELEPORT_ROOT_DEF = Object.freeze({ triggerRadius:46, exitOffset:92, cooldownMs:900 });
  const TIMED_DOOR_DEF = Object.freeze({ cycleMs:2400, openMs:1350 });

  const finite = (value,fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const horizontalOverlap = (a,b) => a.x < b.x + b.width && a.x + a.width > b.x;
  const overlaps = (a,b) => horizontalOverlap(a,b) && a.y < b.y + b.height && a.y + a.height > b.y;

  function hash01(value='') {
    let hash=2166136261;
    for(const char of String(value)){ hash^=char.charCodeAt(0); hash=Math.imul(hash,16777619); }
    return ((hash>>>0)%10000)/10000;
  }

  function currentPhenotype() {
    try {
      const phenotype = window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.activePhenotype || 'plant';
      return ['plant','fire','electric','ice'].includes(phenotype) ? phenotype : 'plant';
    } catch { return 'plant'; }
  }

  function hazardIsActive(type,timeMs=elapsedMs) {
    const def=HAZARD_DEFS[type];
    if(!def || def.mode!=='cycle') return true;
    const cycle=Math.max(1,finite(def.cycleMs,1));
    return (((timeMs%cycle)+cycle)%cycle) < finite(def.activeMs,cycle);
  }

  function phenotypeImmuneToHazard(phenotype,type) {
    return (PHENOTYPE_HAZARD_IMMUNITIES[phenotype] || PHENOTYPE_HAZARD_IMMUNITIES.plant).includes(type);
  }

  function zoneForX(levelData,x) {
    return (levelData?.encounterZones || []).find((zone)=>x>=finite(zone.startX,-Infinity)&&x<=finite(zone.endX,Infinity)) || null;
  }

  function mechanicsAtX(levelData,x) {
    const zone=zoneForX(levelData,x);
    const mechanics=Array.isArray(zone?.mechanics)&&zone.mechanics.length ? zone.mechanics : (levelData?.mechanics || []);
    return [...new Set(mechanics.filter(Boolean))];
  }

  function teleportRootPair(zone) {
    if(!zone || !(zone.mechanics || []).includes('teleport-roots')) return null;
    const start=finite(zone.startX);
    const end=Math.max(start+1,finite(zone.endX,start+1));
    const width=end-start;
    const inset=Math.min(360,Math.max(180,width*.22));
    return Object.freeze({
      entry:Object.freeze({id:`${zone.id || 'zone'}-root-a`,x:start+inset}),
      exit:Object.freeze({id:`${zone.id || 'zone'}-root-b`,x:end-inset})
    });
  }

  function timedDoorsForZone(zone) {
    if(!zone || !(zone.mechanics || []).includes('timed-doors')) return Object.freeze([]);
    const start=finite(zone.startX);
    const end=Math.max(start+1,finite(zone.endX,start+1));
    const width=end-start;
    return Object.freeze([.38,.7].map((ratio,index)=>Object.freeze({
      id:`${zone.id || 'zone'}-door-${index+1}`,
      x:start+width*ratio,
      cycleMs:TIMED_DOOR_DEF.cycleMs,
      openMs:TIMED_DOOR_DEF.openMs,
      phaseMs:index*(TIMED_DOOR_DEF.cycleMs/2)
    })));
  }

  function timedDoorIsOpen(door,timeMs=elapsedMs) {
    const cycle=Math.max(1,finite(door?.cycleMs,TIMED_DOOR_DEF.cycleMs));
    const open=Math.max(0,Math.min(cycle,finite(door?.openMs,TIMED_DOOR_DEF.openMs)));
    const phase=finite(door?.phaseMs,0);
    return ((((timeMs+phase)%cycle)+cycle)%cycle)<open;
  }

  function arenaLockForZone(zone) {
    if(!zone || !(zone.mechanics || []).includes('arena-lock')) return null;
    const start=finite(zone.startX);
    const end=Math.max(start+160,finite(zone.endX,start+160));
    const inset=Math.min(42,Math.max(28,(end-start)*.025));
    return Object.freeze({
      zoneId:zone.id || 'arena',
      leftX:start+inset,
      rightX:end-inset
    });
  }

  function applyArenaLock(next,prior,levelData) {
    const zone=(levelData?.encounterZones || []).find((entry)=>(entry.mechanics || []).includes('arena-lock')) || null;
    const gate=arenaLockForZone(zone);
    if(!gate){
      arenaLockEngaged=false;
      arenaLockZoneId='';
      return next;
    }
    if(levelData?.boss?.defeated){
      if(arenaLockEngaged){
        window.dispatchEvent(new CustomEvent('seedman:arena-unlocked',{detail:{levelId:levelData.id||'',zoneId:arenaLockZoneId||gate.zoneId}}));
      }
      arenaLockEngaged=false;
      arenaLockZoneId='';
      return next;
    }
    const center=finite(next.x)+finite(next.width)/2;
    if(!arenaLockEngaged&&center>=gate.leftX&&center<=gate.rightX){
      arenaLockEngaged=true;
      arenaLockZoneId=gate.zoneId;
      window.dispatchEvent(new CustomEvent('seedman:arena-locked',{detail:{levelId:levelData.id||'',zoneId:gate.zoneId,leftX:gate.leftX,rightX:gate.rightX}}));
    }
    if(!arenaLockEngaged) return next;
    const width=finite(next.width);
    const minX=gate.leftX+2;
    const maxX=Math.max(minX,gate.rightX-width-2);
    if(finite(next.x)<minX){
      next.x=minX;
      next.vx=Math.max(0,finite(next.vx));
      next.__seedArenaBlocked='left';
    }else if(finite(next.x)>maxX){
      next.x=maxX;
      next.vx=Math.min(0,finite(next.vx));
      next.__seedArenaBlocked='right';
    }
    return next;
  }

  function applyTimedDoors(next,prior,levelData) {
    const zones=levelData?.encounterZones || [];
    for(const zone of zones){
      for(const door of timedDoorsForZone(zone)){
        if(timedDoorIsOpen(door)) continue;
        const doorX=finite(door.x);
        const priorLeft=finite(prior?.x);
        const priorRight=priorLeft+finite(prior?.width,next.width);
        const nextLeft=finite(next.x);
        const nextRight=nextLeft+finite(next.width);
        if(priorRight<=doorX&&nextRight>doorX){
          next.x=doorX-finite(next.width)-2;
          next.vx=Math.min(0,finite(next.vx));
          next.__seedTimedDoorBlocked=door.id;
        }else if(priorLeft>=doorX&&nextLeft<doorX){
          next.x=doorX+2;
          next.vx=Math.max(0,finite(next.vx));
          next.__seedTimedDoorBlocked=door.id;
        }
      }
    }
    return next;
  }

  function applyTeleportRoots(next,inputState,levelData,step) {
    teleportCooldownMs=Math.max(0,teleportCooldownMs-step*1000);
    if(teleportCooldownMs>0||!next?.grounded) return next;
    const centerX=finite(next.x)+finite(next.width)/2;
    const zone=zoneForX(levelData,centerX);
    const pair=teleportRootPair(zone);
    if(!pair) return next;
    const triggerRadius=TELEPORT_ROOT_DEF.triggerRadius;
    const nearEntry=Math.abs(centerX-pair.entry.x)<=triggerRadius;
    const nearExit=Math.abs(centerX-pair.exit.x)<=triggerRadius;
    if(!nearEntry&&!nearExit) return next;
    const direction=nearEntry?1:-1;
    const destination=nearEntry?pair.exit:pair.entry;
    next.x=clamp(destination.x+direction*TELEPORT_ROOT_DEF.exitOffset-finite(next.width)/2,0,Math.max(0,finite(levelData.worldWidth)-finite(next.width)));
    next.vy=-210;
    next.grounded=false;
    next.state='jump';
    teleportCooldownMs=TELEPORT_ROOT_DEF.cooldownMs;
    lastTeleportEvent={from:nearEntry?pair.entry.id:pair.exit.id,to:destination.id,levelId:levelData.id||'',timeMs:elapsedMs};
    window.dispatchEvent(new CustomEvent('seedman:teleport-root',{detail:{...lastTeleportEvent}}));
    return next;
  }

  function platformInZone(platform,zone) {
    const center=finite(platform.x)+finite(platform.width)/2;
    return center>=finite(zone.startX,-Infinity)&&center<=finite(zone.endX,Infinity);
  }

  function decorateZonePlatforms(levelData,zone,section,index) {
    const mechanics=new Set(zone.mechanics || []);
    let zonePlatforms=(levelData.platforms || []).filter((platform)=>platformInZone(platform,zone));
    const ground=zonePlatforms.find((platform)=>String(platform.id||'').endsWith('-ground')) || zonePlatforms.find((platform)=>platform.y>=450);
    if(ground && mechanics.has('slippery-ground')) ground.slippery=true;

    const needsTraversal=[...mechanics].some((name)=>['moving-platforms','vertical-platforms','vine-platforms','wall-routes','crystal-bounce','conveyor-platforms','collapsing-platforms','springs'].includes(name));
    let traversal=zonePlatforms.filter((platform)=>platform!==ground&&platform.y<450);
    if(needsTraversal && traversal.length===0 && (mechanics.has('collapsing-platforms')||mechanics.has('springs'))){
      const usableWidth=Math.max(280,finite(zone.endX)-finite(zone.startX));
      const count=mechanics.has('vertical-platforms')?4:3;
      const surface=section?.surface || zone.surface || ground?.surface || 'grass';
      for(let p=0;p<count;p+=1){
        const travel=Math.max(0,usableWidth-440);
        const platform={
          id:`${zone.id}-runtime-platform-${p+1}`,
          x:finite(zone.startX)+220+p*(travel/Math.max(1,count-1)),
          y:480-100-(p%2)*70,
          width:180,height:22,surface:mechanics.has('crystal-bounce')?'ice':surface
        };
        levelData.platforms.push(platform);
        traversal.push(platform);
      }
    }

    traversal.forEach((platform,p)=>{
      if(mechanics.has('moving-platforms')&&!platform.motion) platform.motion={axis:p%2?'y':'x',distance:110,durationMs:2200};
      if(mechanics.has('conveyor-platforms')&&!platform.conveyor) platform.conveyor={speed:p%2?-55:55};
      if(mechanics.has('springs')) platform.bounce={multiplier:1.18};
      if(mechanics.has('crystal-bounce')) platform.bounce={multiplier:1.28};
      if(mechanics.has('collapsing-platforms')) platform.breakaway={cycleMs:2600,activeMs:1550,phaseMs:p*320};
      platform.zoneId=zone.id;
    });
  }

  function enrichLevelFromRecipe(levelData) {
    if(!levelData || preparedLevels.has(levelData)) return levelData;
    const recipe=recipeCatalog?.levels?.[levelData.id] || null;
    const zones=levelData.encounterZones || [];
    if(recipe?.sections?.length===zones.length){
      zones.forEach((zone,index)=>{
        const section=recipe.sections[index] || {};
        zone.surface=section.surface || zone.surface || 'grass';
        zone.mechanics=[...(section.mechanics || [])];
        zone.hazards=[...(section.hazards || [])];
        decorateZonePlatforms(levelData,zone,section,index);
      });
    }
    for(const platform of levelData.platforms || []){
      platform.__seedBaseX=finite(platform.x);
      platform.__seedBaseY=finite(platform.y);
      platform.__seedPrevX=finite(platform.x);
      platform.__seedPrevY=finite(platform.y);
    }
    preparedLevels.add(levelData);
    return levelData;
  }

  function platformActive(platform,timeMs=elapsedMs) {
    const breakaway=platform?.breakaway;
    if(!breakaway) return true;
    const cycle=Math.max(1,finite(breakaway.cycleMs,2600));
    const active=Math.max(1,Math.min(cycle,finite(breakaway.activeMs,1550)));
    const phase=finite(breakaway.phaseMs,hash01(platform.id)*cycle);
    return ((((timeMs+phase)%cycle)+cycle)%cycle)<active;
  }

  function updateDynamicPlatforms(levelData,timeMs=elapsedMs) {
    for(const platform of levelData?.platforms || []){
      if(platform.__seedBaseX==null){platform.__seedBaseX=finite(platform.x);platform.__seedBaseY=finite(platform.y);}
      platform.__seedPrevX=finite(platform.x);
      platform.__seedPrevY=finite(platform.y);
      if(platform.motion){
        const duration=Math.max(240,finite(platform.motion.durationMs,2200));
        const distance=finite(platform.motion.distance,0);
        const phase=hash01(platform.id)*Math.PI*2;
        const offset=Math.sin((timeMs/duration)*Math.PI*2+phase)*distance;
        if(platform.motion.axis==='y'){platform.x=platform.__seedBaseX;platform.y=platform.__seedBaseY+offset;}
        else {platform.x=platform.__seedBaseX+offset;platform.y=platform.__seedBaseY;}
      }
      platform.__runtimeHidden=!platformActive(platform,timeMs);
    }
  }

  function standingOn(playerState,platform,usePrevious=false,tolerance=7) {
    if(!playerState||!platform) return false;
    const px=usePrevious?finite(platform.__seedPrevX,platform.x):finite(platform.x);
    const py=usePrevious?finite(platform.__seedPrevY,platform.y):finite(platform.y);
    const proxy={x:px,y:py,width:finite(platform.width),height:finite(platform.height)};
    const feet=finite(playerState.y)+finite(playerState.height);
    return horizontalOverlap(playerState,proxy)&&Math.abs(feet-proxy.y)<=tolerance;
  }

  function carryPlayerWithPlatform(inputPlayer,levelData) {
    const carried={...inputPlayer};
    for(const platform of levelData?.platforms || []){
      if(platform.__runtimeHidden || !platform.motion || !standingOn(inputPlayer,platform,true,8)) continue;
      carried.x=finite(carried.x)+(finite(platform.x)-finite(platform.__seedPrevX,platform.x));
      carried.y=finite(carried.y)+(finite(platform.y)-finite(platform.__seedPrevY,platform.y));
      break;
    }
    return carried;
  }

  function activePlatforms(levelData) {
    return (levelData?.platforms || []).filter((platform)=>platform.__runtimeHidden!==true);
  }

  function activeLethalHazards(levelData,phenotype) {
    return (levelData?.hazards || []).filter((hazard)=>{
      const def=HAZARD_DEFS[hazard.type];
      if(!def) return true;
      if(!hazardIsActive(hazard.type)) return false;
      if(phenotypeImmuneToHazard(phenotype,hazard.type)) return false;
      return def.damage>0 || def.respawn || def.mode==='trap';
    });
  }

  function applyEnvironmentEffects(next,prior,inputState,levelData,phenotype,dt) {
    const step=clamp(finite(dt),0,.05);
    const centerX=finite(next.x)+finite(next.width)/2;
    const mechanics=new Set(mechanicsAtX(levelData,centerX));
    const support=(levelData.platforms || []).find((platform)=>platform.__runtimeHidden!==true&&standingOn(next,platform,false,9));

    if(next.grounded&&support?.conveyor?.speed) next.x+=finite(support.conveyor.speed)*step;
    if(next.grounded&&support?.bounce?.multiplier){
      next.vy=-620*Math.max(1,finite(support.bounce.multiplier,1));
      next.grounded=false;
      next.state='jump';
    }
    if(next.grounded&&(support?.slippery||support?.surface==='ice'||mechanics.has('slippery-ground'))&&!inputState?.left&&!inputState?.right&&Math.abs(finite(prior?.vx))>8){
      next.vx=finite(prior.vx)*.975;
    }
    if(mechanics.has('wind-zones')) next.vx+=(-78+Math.sin(elapsedMs/620)*52)*step;
    if(mechanics.has('heat-updraft')&&!next.grounded){
      next.vy-=110*step;
      next.vy*=Math.pow(.62,step);
    }

    for(const hazard of levelData?.hazards || []){
      const def=HAZARD_DEFS[hazard.type];
      if(!def||!hazardIsActive(hazard.type)||phenotypeImmuneToHazard(phenotype,hazard.type)) continue;
      if(def.mode==='force'&&horizontalOverlap(next,hazard)) next.vx+=finite(def.forceX)*step;
      if(def.mode==='surface'&&horizontalOverlap(next,hazard)){
        const feet=finite(next.y)+finite(next.height);
        if(feet>=finite(hazard.y)-28&&!inputState?.left&&!inputState?.right) next.vx=finite(prior?.vx,next.vx)*finite(def.friction,.22);
      }
    }
    applyTimedDoors(next,prior,levelData);
    applyTeleportRoots(next,inputState,levelData,step);
    applyArenaLock(next,prior,levelData);
    next.x=clamp(finite(next.x),0,Math.max(0,finite(levelData.worldWidth)-finite(next.width)));
    return next;
  }

  function drawPortal(drawCtx,x,height,label) {
    const baseY=Math.min(height-36,480);
    const gradient=drawCtx.createRadialGradient(x,baseY,4,x,baseY,34);
    gradient.addColorStop(0,'rgba(216,197,255,.22)');
    gradient.addColorStop(.58,'rgba(113,240,157,.32)');
    gradient.addColorStop(1,'rgba(43,129,84,0)');
    drawCtx.fillStyle=gradient;
    drawCtx.beginPath(); drawCtx.arc(x,baseY,34,0,Math.PI*2); drawCtx.fill();
    drawCtx.strokeStyle='rgba(183,255,205,.86)'; drawCtx.lineWidth=4;
    drawCtx.beginPath(); drawCtx.arc(x,baseY,24,Math.PI*.15,Math.PI*1.85); drawCtx.stroke();
    drawCtx.fillStyle='rgba(245,247,244,.92)'; drawCtx.font='800 10px system-ui'; drawCtx.textAlign='center';
    drawCtx.fillText(label,x,baseY-39);
  }

  function drawTimedDoor(drawCtx,door,camera,height) {
    const screenX=Math.round(finite(door.x)-camera);
    if(screenX<-30||screenX>960+30) return;
    const open=timedDoorIsOpen(door);
    const top=116, bottom=Math.min(height-42,486);
    drawCtx.save();
    drawCtx.lineWidth=open?3:8;
    drawCtx.strokeStyle=open?'rgba(101,242,209,.34)':'rgba(255,155,124,.9)';
    drawCtx.setLineDash(open?[8,10]:[]);
    drawCtx.beginPath(); drawCtx.moveTo(screenX,top); drawCtx.lineTo(screenX,bottom); drawCtx.stroke();
    if(!open){
      drawCtx.strokeStyle='rgba(243,200,103,.72)'; drawCtx.lineWidth=2;
      for(let y=top+8;y<bottom;y+=18){drawCtx.beginPath();drawCtx.moveTo(screenX-12,y);drawCtx.lineTo(screenX+12,y+10);drawCtx.stroke();}
    }
    drawCtx.restore();
  }

  function drawArenaGate(drawCtx,x,height,active,label) {
    const top=92, bottom=Math.min(height-34,492);
    drawCtx.save();
    drawCtx.lineWidth=active?9:3;
    drawCtx.strokeStyle=active?'rgba(255,155,124,.94)':'rgba(243,200,103,.28)';
    drawCtx.shadowColor=active?'rgba(255,93,93,.55)':'transparent';
    drawCtx.shadowBlur=active?14:0;
    drawCtx.beginPath(); drawCtx.moveTo(x,top); drawCtx.lineTo(x,bottom); drawCtx.stroke();
    if(active){
      drawCtx.fillStyle='rgba(255,221,188,.94)';
      drawCtx.font='900 10px system-ui';
      drawCtx.textAlign='center';
      drawCtx.fillText(label,x,top-10);
    }
    drawCtx.restore();
  }

  function drawWorldMechanicOverlay() {
    try {
      if(typeof ctx==='undefined'||typeof canvas==='undefined'||typeof level==='undefined'||typeof player==='undefined'||!ctx||!canvas||!level||!player) return;
      const centerX=finite(player.x)+finite(player.width)/2;
      const activeMechanics=new Set(mechanicsAtX(level,centerX));
      const camera=typeof cameraX==='undefined'?0:finite(cameraX);
      if(activeMechanics.has('dark-zones')){
        const px=finite(player.x)-camera+finite(player.width)/2;
        const py=finite(player.y)+finite(player.height)/2;
        const radius=Math.max(150,canvas.height*.34);
        const darkness=ctx.createRadialGradient(px,py,40,px,py,radius);
        darkness.addColorStop(0,'rgba(0,0,0,.08)');
        darkness.addColorStop(.45,'rgba(0,0,0,.34)');
        darkness.addColorStop(1,'rgba(0,0,0,.62)');
        ctx.fillStyle=darkness; ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      for(const zone of level.encounterZones || []){
        const arena=arenaLockForZone(zone);
        if(arena && !level?.boss?.defeated){
          const active=arenaLockEngaged&&arenaLockZoneId===arena.zoneId;
          const left=arena.leftX-camera, right=arena.rightX-camera;
          if(left>-30&&left<canvas.width+30) drawArenaGate(ctx,left,canvas.height,active,'ARENA LOCK');
          if(right>-30&&right<canvas.width+30) drawArenaGate(ctx,right,canvas.height,true,'BOSS GATE');
        }
        const pair=teleportRootPair(zone);
        if(pair){
          const ax=pair.entry.x-camera, bx=pair.exit.x-camera;
          if(ax>-50&&ax<canvas.width+50) drawPortal(ctx,ax,canvas.height,'ROOT A');
          if(bx>-50&&bx<canvas.width+50) drawPortal(ctx,bx,canvas.height,'ROOT B');
        }
        for(const door of timedDoorsForZone(zone)) drawTimedDoor(ctx,door,camera,canvas.height);
      }
      ctx.textAlign='start';
    } catch {}
  }

  function install() {
    if(installed || typeof stepPlayer!=='function') return false;
    const baseStep=stepPlayer;
    stepPlayer=function seedManWorldMechanicsStep(inputPlayer,inputState,levelData,dt,config){
      if(!levelData) return baseStep(inputPlayer,inputState,levelData,dt,config);
      if(levelData.id!==activeLevelId){activeLevelId=levelData.id||'';elapsedMs=0;teleportCooldownMs=0;lastTeleportEvent=null;arenaLockEngaged=false;arenaLockZoneId='';}
      elapsedMs+=clamp(finite(dt),0,.05)*1000;
      enrichLevelFromRecipe(levelData);
      updateDynamicPlatforms(levelData,elapsedMs);
      const phenotype=currentPhenotype();
      const carried=carryPlayerWithPlatform(inputPlayer,levelData);
      const frameLevel={...levelData,platforms:activePlatforms(levelData),hazards:activeLethalHazards(levelData,phenotype)};
      const next=baseStep(carried,inputState,frameLevel,dt,config);
      return applyEnvironmentEffects(next,carried,inputState,levelData,phenotype,dt);
    };
    if(typeof render==='function'){
      const baseRender=render;
      render=function seedManWorldMechanicsRender(){baseRender();drawWorldMechanicOverlay();};
    }
    installed=true;
    document.documentElement.dataset.seedManWorldMechanics=VERSION;
    window.dispatchEvent(new CustomEvent('seedman:world-mechanics-ready',{detail:{version:VERSION}}));
    return true;
  }

  async function loadRecipes() {
    try {
      const response=await fetch(RECIPE_URL,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      recipeCatalog=await response.json();
      document.documentElement.dataset.seedManWorldMechanicsRecipes='ready';
      try { if(typeof level!=='undefined'&&level) enrichLevelFromRecipe(level); } catch {}
    } catch(error) {
      document.documentElement.dataset.seedManWorldMechanicsRecipes='degraded';
      console.error('[Seed Man] world mechanics recipe enrichment failed.',error);
    }
  }

  window.__SEED_MAN_WORLD_MECHANICS__=Object.freeze({
    version:VERSION,
    sourceContract:SOURCE_CONTRACT,
    installed:()=>installed,
    phenotypeImmuneToHazard,
    hazardIsActive,
    mechanicsAtX,
    teleportRootPair,
    timedDoorsForZone,
    timedDoorIsOpen,
    arenaLockForZone,
    snapshot:()=>Object.freeze({version:VERSION,installed,recipesReady:Boolean(recipeCatalog),activeLevelId,elapsedMs,teleportCooldownMs,lastTeleportEvent,arenaLockEngaged,arenaLockZoneId})
  });

  install();
  loadRecipes();
  window.addEventListener('sprout:level-selected',()=>{activeLevelId='';elapsedMs=0;teleportCooldownMs=0;lastTeleportEvent=null;arenaLockEngaged=false;arenaLockZoneId='';try{if(typeof level!=='undefined'&&level)enrichLevelFromRecipe(level);}catch{}});
})();
