export const HAZARD_DEFS=Object.freeze({
  'spikes':Object.freeze({damage:1,mode:'contact',knockbackY:-260}),
  'toxic-slime':Object.freeze({damage:1,mode:'contact',status:'poison',statusMs:2200,slow:.82}),
  'waterfall-gap':Object.freeze({damage:0,mode:'pit',respawn:true}),
  'thorn-pits':Object.freeze({damage:1,mode:'contact',status:'bleed',statusMs:1200}),
  'falling-bridges':Object.freeze({damage:0,mode:'breakaway',delayMs:420,respawnMs:2400}),
  'spore-cloud':Object.freeze({damage:1,mode:'zone',tickMs:900,status:'poison',statusMs:1800}),
  'root-cage':Object.freeze({damage:1,mode:'trap',holdMs:700}),
  'lava':Object.freeze({damage:2,mode:'contact',status:'burn',statusMs:1800,knockbackY:-300}),
  'rockfall':Object.freeze({damage:2,mode:'cycle',cycleMs:2200,activeMs:700}),
  'falling-rocks':Object.freeze({damage:1,mode:'cycle',cycleMs:1800,activeMs:650}),
  'sandstorm':Object.freeze({damage:0,mode:'force',forceX:-90,visibility:.72}),
  'ice-spikes':Object.freeze({damage:1,mode:'contact',knockbackY:-220}),
  'falling-icicles':Object.freeze({damage:2,mode:'cycle',cycleMs:2100,activeMs:650}),
  'breakaway-ice':Object.freeze({damage:0,mode:'breakaway',delayMs:520,respawnMs:2800}),
  'freeze-floor':Object.freeze({damage:0,mode:'surface',friction:.22,accelerationMultiplier:.78}),
  'electric-floor':Object.freeze({damage:1,mode:'cycle',cycleMs:1600,activeMs:800,status:'stun',statusMs:420}),
  'laser-grid':Object.freeze({damage:2,mode:'cycle',cycleMs:2000,activeMs:850}),
  'crusher':Object.freeze({damage:3,mode:'cycle',cycleMs:2600,activeMs:700}),
  'energy-beam':Object.freeze({damage:2,mode:'cycle',cycleMs:1800,activeMs:600,status:'stun',statusMs:300})
});

export function getHazardDefinition(type){const def=HAZARD_DEFS[type];if(!def)throw new Error(`Unknown Seed Man hazard: ${type}`);return def;}
export function hazardIsActive(type,elapsedMs=0){const def=getHazardDefinition(type);if(def.mode!=='cycle')return true;const cycle=Math.max(1,def.cycleMs||1);return ((elapsedMs%cycle)+cycle)%cycle < (def.activeMs||cycle);}
export function resolveHazardContact(type,{elapsedMs=0,player={}}={}){
  const def=getHazardDefinition(type);
  if(!hazardIsActive(type,elapsedMs))return Object.freeze({active:false,damage:0});
  return Object.freeze({active:true,damage:def.damage||0,status:def.status||null,statusMs:def.statusMs||0,respawn:Boolean(def.respawn),forceX:def.forceX||0,friction:def.friction??null,knockbackY:def.knockbackY||0,holdMs:def.holdMs||0,playerId:player.id||null});
}
export function instantiateHazard(placement){const def=getHazardDefinition(placement.type);return Object.freeze({...placement,definition:def});}
