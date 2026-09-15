import { getHazardDefinition, hazardIsActive } from './hazard-system.mjs';

export const PHENOTYPE_HAZARD_IMMUNITIES = Object.freeze({
  plant: Object.freeze([]),
  fire: Object.freeze(['lava']),
  electric: Object.freeze(['electric-floor','energy-beam']),
  ice: Object.freeze(['freeze-floor'])
});

export const WORLD_MECHANIC_DEFS = Object.freeze({
  'moving-platforms': Object.freeze({kind:'platform-motion'}),
  'vertical-platforms': Object.freeze({kind:'platform-layout'}),
  'vine-platforms': Object.freeze({kind:'platform-layout'}),
  'wall-routes': Object.freeze({kind:'platform-layout'}),
  'springs': Object.freeze({kind:'bounce',multiplier:1.18}),
  'crystal-bounce': Object.freeze({kind:'bounce',multiplier:1.28}),
  'collapsing-platforms': Object.freeze({kind:'breakaway',cycleMs:2600,activeMs:1550}),
  'dark-zones': Object.freeze({kind:'visibility',visibility:.55}),
  'teleport-roots': Object.freeze({kind:'teleport'}),
  'heat-updraft': Object.freeze({kind:'air-force',gravityMultiplier:.62,liftPerSecond:110}),
  'wind-zones': Object.freeze({kind:'air-force',forceX:-78,gustX:52}),
  'slippery-ground': Object.freeze({kind:'surface',frictionMultiplier:.24,accelerationMultiplier:.8}),
  'conveyor-platforms': Object.freeze({kind:'surface-motion'}),
  'timed-doors': Object.freeze({kind:'gate-cycle',cycleMs:2400,openMs:1350}),
  'arena-lock': Object.freeze({kind:'boss-gate'})
});

function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function horizontalOverlap(a,b){return a.x < b.x + b.width && a.x + a.width > b.x;}
function overlaps(a,b){return horizontalOverlap(a,b) && a.y < b.y + b.height && a.y + a.height > b.y;}
function unique(values=[]){return [...new Set(values.filter(Boolean))];}

function hash01(value=''){
  let hash=2166136261;
  for(const char of String(value)){
    hash^=char.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return ((hash>>>0)%10000)/10000;
}

export function mechanicsAtX(level,x){
  const zones=Array.isArray(level?.encounterZones)?level.encounterZones:[];
  const zone=zones.find((entry)=>x>=finite(entry.startX,-Infinity)&&x<=finite(entry.endX,Infinity));
  if(zone?.mechanics?.length)return Object.freeze(unique(zone.mechanics));
  return Object.freeze(unique(level?.mechanics||[]));
}

export function phenotypeImmuneToHazard(phenotype='plant',type){
  return (PHENOTYPE_HAZARD_IMMUNITIES[phenotype]||PHENOTYPE_HAZARD_IMMUNITIES.plant).includes(type);
}

export function platformIsActive(platform,level,elapsedMs=0){
  if(platform?.breakaway){
    const cycle=Math.max(1,finite(platform.breakaway.cycleMs,2600));
    const active=Math.max(1,Math.min(cycle,finite(platform.breakaway.activeMs,1550)));
    const phase=finite(platform.breakaway.phaseMs,hash01(platform.id)*cycle);
    return (((elapsedMs+phase)%cycle)+cycle)%cycle < active;
  }
  const mechanics=mechanicsAtX(level,finite(platform?.x,0));
  const candidate=mechanics.includes('collapsing-platforms')&&finite(platform?.height,60)<=30&&finite(platform?.y,480)<450;
  if(!candidate)return true;
  const cycle=2600;
  const active=1550;
  const phase=hash01(platform?.id||`${platform?.x}:${platform?.y}`)*cycle;
  return (((elapsedMs+phase)%cycle)+cycle)%cycle < active;
}

export function resolvePlatformAtTime(platform,level,elapsedMs=0){
  if(!platformIsActive(platform,level,elapsedMs))return null;
  const resolved={...platform};
  if(platform?.motion){
    const duration=Math.max(240,finite(platform.motion.durationMs,2200));
    const distance=finite(platform.motion.distance,0);
    const phase=hash01(platform.id)*Math.PI*2;
    const offset=Math.sin((elapsedMs/duration)*Math.PI*2+phase)*distance;
    if(platform.motion.axis==='y')resolved.y=finite(platform.y)+offset;
    else resolved.x=finite(platform.x)+offset;
  }
  return resolved;
}

export function resolvePlatformsAtTime(level,elapsedMs=0){
  return Object.freeze((level?.platforms||[]).map((platform)=>resolvePlatformAtTime(platform,level,elapsedMs)).filter(Boolean));
}

export function platformDelta(level,platformId,elapsedMs=0,dtSeconds=0){
  if(!platformId)return Object.freeze({x:0,y:0});
  const source=(level?.platforms||[]).find((platform)=>platform.id===platformId);
  if(!source)return Object.freeze({x:0,y:0});
  const current=resolvePlatformAtTime(source,level,elapsedMs);
  const previous=resolvePlatformAtTime(source,level,Math.max(0,elapsedMs-dtSeconds*1000));
  if(!current||!previous)return Object.freeze({x:0,y:0});
  return Object.freeze({x:finite(current.x)-finite(previous.x),y:finite(current.y)-finite(previous.y)});
}

export function activeHazardsForPhysics(level,{elapsedMs=0,phenotype='plant'}={}){
  const hazards=[];
  for(const hazard of level?.hazards||[]){
    let def;
    try{def=getHazardDefinition(hazard.type);}catch{continue;}
    if(!hazardIsActive(hazard.type,elapsedMs))continue;
    if(phenotypeImmuneToHazard(phenotype,hazard.type))continue;
    if(def.damage>0||def.respawn||def.mode==='trap')hazards.push(hazard);
  }
  return Object.freeze(hazards);
}

export function environmentEffectsAtPlayer(level,player,{elapsedMs=0,phenotype='plant'}={}){
  const mechanics=mechanicsAtX(level,finite(player?.x,0)+finite(player?.width,0)/2);
  const effects={
    forceX:0,
    liftPerSecond:0,
    gravityMultiplier:1,
    frictionMultiplier:1,
    accelerationMultiplier:1,
    visibility:1,
    conveyorSpeed:0,
    bounceMultiplier:0,
    activeMechanics:[...mechanics]
  };

  if(mechanics.includes('wind-zones')){
    const def=WORLD_MECHANIC_DEFS['wind-zones'];
    effects.forceX+=def.forceX+Math.sin(elapsedMs/620)*def.gustX;
  }
  if(mechanics.includes('heat-updraft')){
    const def=WORLD_MECHANIC_DEFS['heat-updraft'];
    effects.gravityMultiplier=Math.min(effects.gravityMultiplier,def.gravityMultiplier);
    effects.liftPerSecond=Math.max(effects.liftPerSecond,def.liftPerSecond);
  }
  if(mechanics.includes('slippery-ground')){
    const def=WORLD_MECHANIC_DEFS['slippery-ground'];
    effects.frictionMultiplier=Math.min(effects.frictionMultiplier,def.frictionMultiplier);
    effects.accelerationMultiplier=Math.min(effects.accelerationMultiplier,def.accelerationMultiplier);
  }
  if(mechanics.includes('dark-zones'))effects.visibility=Math.min(effects.visibility,WORLD_MECHANIC_DEFS['dark-zones'].visibility);
  if(mechanics.includes('springs'))effects.bounceMultiplier=Math.max(effects.bounceMultiplier,WORLD_MECHANIC_DEFS.springs.multiplier);
  if(mechanics.includes('crystal-bounce'))effects.bounceMultiplier=Math.max(effects.bounceMultiplier,WORLD_MECHANIC_DEFS['crystal-bounce'].multiplier);

  for(const hazard of level?.hazards||[]){
    let def;
    try{def=getHazardDefinition(hazard.type);}catch{continue;}
    if(!hazardIsActive(hazard.type,elapsedMs)||phenotypeImmuneToHazard(phenotype,hazard.type))continue;
    const horizontal=horizontalOverlap(player,hazard);
    const contact=overlaps(player,hazard);
    const surfaceContact=horizontal&&finite(player?.y)+finite(player?.height)>=finite(hazard?.y)-28;
    if(def.mode==='force'&&horizontal)effects.forceX+=finite(def.forceX,0);
    if(def.mode==='surface'&&surfaceContact){
      effects.frictionMultiplier=Math.min(effects.frictionMultiplier,finite(def.friction,1));
      effects.accelerationMultiplier=Math.min(effects.accelerationMultiplier,finite(def.accelerationMultiplier,1));
    }
    if(def.visibility&&horizontal)effects.visibility=Math.min(effects.visibility,def.visibility);
    if(contact&&def.knockbackY<0)effects.bounceMultiplier=Math.max(effects.bounceMultiplier,.45);
  }

  const resolvedPlatforms=resolvePlatformsAtTime(level,elapsedMs);
  const feet=finite(player?.y)+finite(player?.height);
  const support=resolvedPlatforms.find((platform)=>horizontalOverlap(player,platform)&&Math.abs(feet-finite(platform.y))<=5);
  if(support?.surface==='ice'){
    effects.frictionMultiplier=Math.min(effects.frictionMultiplier,.28);
    effects.accelerationMultiplier=Math.min(effects.accelerationMultiplier,.82);
  }
  if(support?.conveyor?.speed)effects.conveyorSpeed=finite(support.conveyor.speed,0);
  if(support?.bounce?.multiplier)effects.bounceMultiplier=Math.max(effects.bounceMultiplier,finite(support.bounce.multiplier,0));

  return Object.freeze({...effects,activeMechanics:Object.freeze(effects.activeMechanics)});
}

export function materializeFrameLevel(level,{elapsedMs=0,phenotype='plant'}={}){
  return Object.freeze({
    ...level,
    platforms:resolvePlatformsAtTime(level,elapsedMs),
    hazards:activeHazardsForPhysics(level,{elapsedMs,phenotype}),
    activePhenotype:phenotype,
    runtimeTimeMs:elapsedMs
  });
}

export function applyWorldMotion(inputPlayer,sourceLevel,{elapsedMs=0,dt=0,phenotype='plant'}={}){
  const player={...inputPlayer};
  const step=clamp(finite(dt,0),0,.05);
  const carry=platformDelta(sourceLevel,player.groundPlatformId,elapsedMs,step);
  player.x=finite(player.x)+carry.x;
  player.y=finite(player.y)+carry.y;
  const effects=environmentEffectsAtPlayer(sourceLevel,player,{elapsedMs,phenotype});
  player.vx=finite(player.vx)+effects.forceX*step+effects.conveyorSpeed*step;
  if(!player.grounded)player.vy=finite(player.vy)-effects.liftPerSecond*step;
  return Object.freeze({player:Object.freeze(player),effects});
}
