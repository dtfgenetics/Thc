export const TRANSITION_MODELS=Object.freeze({
  linear:Object.freeze({id:'linear',label:'Linear',equivalentFactor:0.5,description:'Flux changes at a constant rate across the ramp.'}),
  slowEdge:Object.freeze({id:'slow-edge',label:'Slow edge',equivalentFactor:1/3,description:'Modeled ramp spends more time near low output.'}),
  fastEdge:Object.freeze({id:'fast-edge',label:'Fast edge',equivalentFactor:2/3,description:'Modeled ramp spends more time near high output.'})
});
export function transitionModel(model='linear'){
  const key=String(model||'linear');
  return Object.values(TRANSITION_MODELS).find(row=>row.id===key)||TRANSITION_MODELS.linear;
}
export function transitionEquivalentFactor(model='linear'){return transitionModel(model).equivalentFactor}
export function effectiveLightHours({clockHours,dawnMinutes=0,duskMinutes=0,model='linear'}={}){
  const h=Number(clockHours),dawn=Number(dawnMinutes),dusk=Number(duskMinutes);
  if(!Number.isFinite(h)||h<0||h>24)throw new Error('Clock light hours must be between 0 and 24');
  if(!Number.isFinite(dawn)||dawn<0||!Number.isFinite(dusk)||dusk<0)throw new Error('Ramp minutes must be zero or greater');
  const rampHours=(dawn+dusk)/60;
  if(rampHours>h)throw new Error('Combined ramp duration cannot exceed the clock light window');
  const factor=transitionEquivalentFactor(model);
  return {effectiveHours:h-rampHours+(rampHours*factor),rampHours,equivalentFactor:factor,model:transitionModel(model).id};
}
