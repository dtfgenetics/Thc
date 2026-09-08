import { phenotypeRemainingMs } from './phenotype-system.mjs';

export function buildHudModel({health=3,maxHealth=3,energy=100,maxEnergy=100,lives=3,seeds=0,world=1,level=1,phenotypeState,nowMs=0,boss=null}={}){
  const phenotype=phenotypeState?.active||'plant';
  return Object.freeze({health,maxHealth,energy,maxEnergy,lives,seeds,world,level,phenotype,phenotypeRemainingMs:phenotypeState?phenotypeRemainingMs(phenotypeState,nowMs):0,boss:boss?Object.freeze({id:boss.id,health:boss.health,maxHealth:boss.maxHealth,phase:boss.phase,defeated:boss.defeated}):null});
}
