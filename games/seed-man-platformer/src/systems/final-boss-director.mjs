import { createBossState,stepBossState,nextBossAttack,bossWeakness,advanceBossAttack } from './boss-state-machine.mjs';

export function createFinalBossDirector(definition){
  if(!definition?.finalBoss)throw new Error('Final boss director requires finalBoss definition');
  let state=createBossState(definition);
  return {
    snapshot:()=>({...state,weakness:bossWeakness(state,definition),nextAttack:nextBossAttack(state,definition)}),
    damage(amount,phenotype){
      const weakness=bossWeakness(state,definition);
      const multiplier=phenotype===weakness?1.5:0.65;
      state=stepBossState({...state,invulnerable:false},definition,0,{damage:amount*multiplier});
      return this.snapshot();
    },
    step(dt){
      state=stepBossState(state,definition,dt);
      if(!state.defeated&&state.attackCooldown<=0)state=advanceBossAttack(state,definition);
      return this.snapshot();
    }
  };
}
