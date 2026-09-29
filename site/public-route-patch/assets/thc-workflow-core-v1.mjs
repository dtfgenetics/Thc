const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function normalizeSteps(steps,limit=40){
  if(!Array.isArray(steps))return [];
  return steps.slice(0,clamp(Number(limit)||40,1,100)).map((step,index)=>({
    id:String(step?.id||('step-'+(index+1))).trim().slice(0,80),
    label:String(step?.label||step?.title||('Step '+(index+1))).trim().slice(0,240),
    detail:String(step?.detail||'').trim().slice(0,1000),
    required:step?.required!==false
  })).filter(step=>step.id&&step.label);
}
export function createWorkflow({id='workflow',title='Guided workflow',steps=[]}={}){
  const normalized=normalizeSteps(steps);
  return {schema:'thc-guided-workflow',version:1,id:String(id).slice(0,80),title:String(title).slice(0,180),steps:normalized,completedIds:[],startedAt:new Date().toISOString(),completedAt:null};
}
export function restoreWorkflow(input,expectedSteps=[]){
  const fresh=createWorkflow({id:input?.id,title:input?.title,steps:expectedSteps.length?expectedSteps:input?.steps});
  if(input?.schema!=='thc-guided-workflow'||Number(input?.version)!==1)return fresh;
  const allowed=new Set(fresh.steps.map(step=>step.id));
  fresh.completedIds=[...new Set(Array.isArray(input.completedIds)?input.completedIds.map(String):[])].filter(id=>allowed.has(id));
  fresh.startedAt=typeof input.startedAt==='string'?input.startedAt:fresh.startedAt;
  fresh.completedAt=isComplete(fresh)?(typeof input.completedAt==='string'?input.completedAt:new Date().toISOString()):null;
  return fresh;
}
export function setStepComplete(workflow,stepId,complete=true){
  const next={...workflow,completedIds:[...(workflow?.completedIds||[])]};
  const allowed=new Set((workflow?.steps||[]).map(step=>step.id));
  if(!allowed.has(String(stepId)))return next;
  const done=new Set(next.completedIds);
  complete?done.add(String(stepId)):done.delete(String(stepId));
  next.completedIds=[...done].filter(id=>allowed.has(id));
  next.completedAt=isComplete(next)?(next.completedAt||new Date().toISOString()):null;
  return next;
}
export function progress(workflow){
  const steps=workflow?.steps||[],done=new Set(workflow?.completedIds||[]);
  const required=steps.filter(step=>step.required!==false),requiredDone=required.filter(step=>done.has(step.id)).length;
  return {completed:steps.filter(step=>done.has(step.id)).length,total:steps.length,requiredCompleted:requiredDone,requiredTotal:required.length,percent:required.length?Math.round(requiredDone/required.length*100):100};
}
export function isComplete(workflow){const p=progress(workflow);return p.requiredCompleted===p.requiredTotal;}
export function nextStep(workflow){const done=new Set(workflow?.completedIds||[]);return (workflow?.steps||[]).find(step=>step.required!==false&&!done.has(step.id))||null;}
export function recipeMixSteps(products,{includeVerify=true}={}){
  const active=(Array.isArray(products)?products:[]).filter(p=>Number(p?.amount??p?.g)>0);
  const steps=[{id:'verify-source',label:'Verify source water and starting measurements',detail:'Confirm source water, volume, starting EC/pH, and the recipe before adding products.'}];
  active.forEach((p,index)=>steps.push({id:'add-'+(index+1),label:'Add '+String(p.name||('Product '+(index+1))).slice(0,120),detail:'Measure '+Number(p.amount??p.g).toFixed(2)+' '+String(p.unit||'g')+', add completely, and allow it to disperse before continuing.'}));
  if(includeVerify)steps.push({id:'verify-final',label:'Verify final EC and pH',detail:'Measure the mixed solution. Record actual values; do not assume calculated nutrient targets predict conductivity or pH.'});
  return normalizeSteps(steps);
}
