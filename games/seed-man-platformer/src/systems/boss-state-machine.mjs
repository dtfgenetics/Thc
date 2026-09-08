const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function createBossState(definition){
  if(!definition?.id) throw new Error('Boss definition requires id');
  const maxHealth=Number(definition.hp||1);
  return {
    id:definition.id,
    health:maxHealth,
    maxHealth,
    phase:1,
    defeated:false,
    invulnerable:false,
    attackCooldown:0,
    attackIndex:0,
    elapsed:0,
    enraged:false
  };
}

export function stepBossState(state,definition,dt,{damage=0}={}){
  if(state.defeated) return state;
  const next={...state,elapsed:state.elapsed+dt,attackCooldown:Math.max(0,state.attackCooldown-dt)};
  if(!next.invulnerable && damage>0) next.health=clamp(next.health-damage,0,next.maxHealth);
  const phaseCount=Math.max(1,Number(definition.phases||1));
  const healthRatio=next.health/next.maxHealth;
  const computedPhase=Math.min(phaseCount,Math.max(1,phaseCount-Math.ceil(healthRatio*phaseCount)+1));
  if(computedPhase!==next.phase){
    next.phase=computedPhase;
    next.invulnerable=true;
    next.attackCooldown=Math.max(next.attackCooldown,0.8);
  }
  if(next.invulnerable && next.attackCooldown<=0.35) next.invulnerable=false;
  next.enraged=next.phase===phaseCount;
  if(next.health<=0){next.health=0;next.defeated=true;next.invulnerable=false;}
  return next;
}

export function nextBossAttack(state,definition){
  const attacks=definition.attacks||[];
  if(!attacks.length) return null;
  const phaseBias=Math.max(0,(state.phase-1));
  const index=(state.attackIndex+phaseBias)%attacks.length;
  return attacks[index];
}

export function bossWeakness(state,definition){
  const rule=(definition.phaseRules||[]).find(entry=>entry.phase===state.phase);
  return rule?.weakness||null;
}

export function advanceBossAttack(state,definition){
  const attacks=definition.attacks||[];
  if(!attacks.length) return state;
  return {...state,attackIndex:(state.attackIndex+1)%attacks.length,attackCooldown:Math.max(0.45,1.15-(state.phase-1)*0.12)};
}
