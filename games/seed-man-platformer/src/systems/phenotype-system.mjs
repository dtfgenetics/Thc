export const PHENOTYPES=Object.freeze({
  plant:Object.freeze({id:'plant',durationMs:0,projectile:'plant-shot',effect:'pierce',damage:1,cooldownMs:320}),
  fire:Object.freeze({id:'fire',durationMs:30000,projectile:'fire-shot',effect:'burn',damage:2,cooldownMs:420}),
  electric:Object.freeze({id:'electric',durationMs:30000,projectile:'electric-shot',effect:'chain',damage:1,cooldownMs:380}),
  ice:Object.freeze({id:'ice',durationMs:30000,projectile:'ice-shot',effect:'freeze',damage:1,cooldownMs:400})
});

export function createPhenotypeState(){return {active:'plant',expiresAt:0,discovered:new Set(['plant'])};}

export function absorbPhenotype(state,id,nowMs){
  const def=PHENOTYPES[id];
  if(!def||id==='plant') return state;
  const discovered=new Set(state.discovered||[]);discovered.add(id);
  return {...state,active:id,expiresAt:nowMs+def.durationMs,discovered};
}

export function updatePhenotype(state,nowMs){
  if(state.active!=='plant'&&state.expiresAt>0&&nowMs>=state.expiresAt) return {...state,active:'plant',expiresAt:0};
  return state;
}

export function phenotypeRemainingMs(state,nowMs){
  if(state.active==='plant') return 0;
  return Math.max(0,state.expiresAt-nowMs);
}

export function phenotypeAttack(state){return PHENOTYPES[state.active]||PHENOTYPES.plant;}
