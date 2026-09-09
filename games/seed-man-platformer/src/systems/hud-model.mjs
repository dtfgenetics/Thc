import { phenotypeRemainingMs } from './phenotype-system.mjs';
import { normalizePlayerState } from './player-state.mjs';

export function buildHudModel({playerState=null,health=3,maxHealth=3,energy=100,maxEnergy=100,lives=3,seeds=0,world=1,level=1,phenotypeState,nowMs=0,boss=null}={}){
  const player=normalizePlayerState(playerState||{health,maxHealth,energy,maxEnergy,lives,seeds,world,level,phenotypeState},nowMs);
  const phenotype=player.phenotypeState?.active||'plant';
  return Object.freeze({
    health:player.health,
    maxHealth:player.maxHealth,
    energy:player.energy,
    maxEnergy:player.maxEnergy,
    lives:player.lives,
    seeds:player.seeds,
    world:player.world,
    level:player.level,
    movementState:player.movementState,
    deaths:player.deaths,
    enemyHits:player.enemyHits,
    finished:player.finished,
    phenotype,
    phenotypeRemainingMs:phenotypeRemainingMs(player.phenotypeState,nowMs),
    boss:boss?Object.freeze({id:boss.id,health:boss.health,maxHealth:boss.maxHealth,phase:boss.phase,defeated:boss.defeated}):null
  });
}
