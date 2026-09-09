import { createPhenotypeState, updatePhenotype } from './phenotype-system.mjs';

export const PLAYER_STATE_VERSION='seed-man-player-state-v20';
export const PLAYER_MOVEMENT_STATES=Object.freeze(['idle','run','jump','double-jump','fall','hurt','finish']);

export function createPlayerState({health=3,maxHealth=3,lives=3,energy=100,maxEnergy=100,seeds=0,world=1,level=1,phenotypeState=createPhenotypeState()}={}){
  return {
    version:PLAYER_STATE_VERSION,
    health:Math.max(0,Math.min(maxHealth,health)),
    maxHealth:Math.max(1,maxHealth),
    lives:Math.max(0,lives),
    energy:Math.max(0,Math.min(maxEnergy,energy)),
    maxEnergy:Math.max(1,maxEnergy),
    seeds:Math.max(0,seeds),
    world:Math.max(1,world),
    level:Math.max(1,level),
    phenotypeState,
    movementState:'idle',
    invulnerableUntil:0,
    deaths:0,
    enemyHits:0,
    finished:false
  };
}

export function normalizePlayerState(input={},nowMs=0){
  const maxHealth=Math.max(1,Number(input.maxHealth)||3);
  const maxEnergy=Math.max(1,Number(input.maxEnergy)||100);
  const movementState=PLAYER_MOVEMENT_STATES.includes(input.movementState)?input.movementState:'idle';
  return {
    ...createPlayerState({
      health:Number.isFinite(input.health)?input.health:maxHealth,
      maxHealth,
      lives:Number.isFinite(input.lives)?input.lives:3,
      energy:Number.isFinite(input.energy)?input.energy:maxEnergy,
      maxEnergy,
      seeds:Number.isFinite(input.seeds)?input.seeds:0,
      world:Number.isFinite(input.world)?input.world:1,
      level:Number.isFinite(input.level)?input.level:1,
      phenotypeState:updatePhenotype(input.phenotypeState||createPhenotypeState(),nowMs)
    }),
    movementState,
    invulnerableUntil:Math.max(0,Number(input.invulnerableUntil)||0),
    deaths:Math.max(0,Number(input.deaths)||0),
    enemyHits:Math.max(0,Number(input.enemyHits)||0),
    finished:Boolean(input.finished)
  };
}

export function applyPlayerDamage(state,{damage=1,nowMs=0,invulnerabilityMs=850}={}){
  const current=normalizePlayerState(state,nowMs);
  if(current.finished||nowMs<current.invulnerableUntil||damage<=0)return current;
  const health=Math.max(0,current.health-damage);
  return {...current,health,enemyHits:current.enemyHits+1,movementState:'hurt',invulnerableUntil:nowMs+invulnerabilityMs};
}

export function completePlayerLevel(state){
  const current=normalizePlayerState(state);
  return {...current,finished:true,movementState:'finish'};
}

export function setPlayerMovementState(state,movementState){
  if(!PLAYER_MOVEMENT_STATES.includes(movementState))throw new Error(`Unsupported Seed Man movement state: ${movementState}`);
  return {...state,movementState};
}

export function assertPlayerStateContract(state){
  const normalized=normalizePlayerState(state);
  if(normalized.version!==PLAYER_STATE_VERSION)throw new Error('Seed Man player-state version mismatch');
  if(normalized.health<0||normalized.health>normalized.maxHealth)throw new Error('Seed Man health state invalid');
  if(normalized.energy<0||normalized.energy>normalized.maxEnergy)throw new Error('Seed Man energy state invalid');
  if(!PLAYER_MOVEMENT_STATES.includes(normalized.movementState))throw new Error('Seed Man movement state invalid');
  const phenotype=normalized.phenotypeState?.active;
  if(!['plant','fire','electric','ice'].includes(phenotype))throw new Error(`Seed Man phenotype state invalid: ${phenotype}`);
  for(const retired of ['speedTimer','jumpTimer','magnetTimer','shieldCharges','collectedPowerups']){
    if(Object.hasOwn(normalized,retired)||Object.hasOwn(normalized.phenotypeState||{},retired))throw new Error(`Retired player state leaked into v20: ${retired}`);
  }
  return normalized;
}
