import {NUTRIENTS, evaluateRecipe, optimizeRecipe} from './thc-fertigation-solver-v1.mjs';

const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj??{},key);
const valid=(value,label)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new RangeError(label+' must be a finite non-negative number');
  return value;
};

/**
 * Preflight and postflight checks for a dry-fertilizer mass-based recipe.
 * Units: volume L, product quantities g, elemental analysis mass %, dissolved elements mg/L.
 * This module deliberately does not predict pH, EC, solubility, product compatibility,
 * crop suitability, or the physical properties of a mixed solution.
 */
export function auditFertigationRecipe({volumeL,sourceWater={},targets={},products=[],amounts,absoluteToleranceMgL=2,relativeTolerance=0.05}){
  if(typeof volumeL!=='number'||!Number.isFinite(volumeL)||volumeL<=0)throw new RangeError('Final volume must be a positive number of liters');
  if(!Array.isArray(products)||!products.length)throw new RangeError('At least one product is required');
  if(!targets||typeof targets!=='object')throw new TypeError('Targets must be an object');
  for(const [key,value] of Object.entries(targets)){
    if(!NUTRIENTS.includes(key))throw new RangeError('Unknown target element: '+key);
    valid(value,'Target '+key);
  }
  if(!Object.keys(targets).length)throw new RangeError('At least one explicit target is required');
  for(const [key,value] of Object.entries(sourceWater)){
    if(!NUTRIENTS.includes(key))throw new RangeError('Unknown source-water element: '+key);
    valid(value,'Source '+key);
  }
  valid(absoluteToleranceMgL,'Absolute tolerance');
  valid(relativeTolerance,'Relative tolerance');
  const issues=[];
  const add=(severity,code,message,element)=>issues.push({severity,code,message,...(element?{element}:{})});
  for(let i=0;i<products.length;i++){
    const p=products[i];
    if(!p||typeof p!=='object'||Array.isArray(p))throw new TypeError('Product '+(i+1)+' must be an analysis object');
    const keys=['N','P','P2O5','K','K2O','Ca','Mg','S','Fe','Mn','Zn','Cu','B','Mo'];
    for(const [k,v] of Object.entries(p)){
      if(!keys.includes(k))continue;
      if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw new RangeError('Product '+(i+1)+' '+k+' must be 0–100 mass percent');
    }
    if(has(p,'P')&&has(p,'P2O5'))add('error','ambiguous-phosphorus','Product '+(i+1)+' supplies both P and P2O5; specify a single verified basis');
    if(has(p,'K')&&has(p,'K2O'))add('error','ambiguous-potassium','Product '+(i+1)+' supplies both K and K2O; specify a single verified basis');
    if(has(p,'P')&&!has(p,'P2O5'))add('warning','phosphorus-label-basis','The underlying solver interprets product P as P2O5 mass percent, not elemental P');
    if(has(p,'K')&&!has(p,'K2O'))add('warning','potassium-label-basis','The underlying solver interprets product K as K2O mass percent, not elemental K');
    const labelSum=keys.reduce((sum,k)=>sum+(has(p,k)?p[k]:0),0);
    if(labelSum>100+1e-9)add('warning','analysis-total','Product '+(i+1)+' reported percentage sum exceeds 100%; verify the label and reporting bases');
  }
  const targetKeys=Object.keys(targets);
  for(const k of targetKeys){
    const source=sourceWater[k]??0;
    if(source>targets[k]+1e-9)add('error','source-exceeds-target','Source water '+k+' exceeds the specified target; adding fertilizer cannot reduce it',k);
    const supplied=products.some(p=>((k==='P'?(p.P2O5??p.P??0):k==='K'?(p.K2O??p.K??0):p[k]??0)>0));
    if(targets[k]>source&&!supplied)add('error','missing-source','No product supplies '+k+' to reach the target',k);
  }
  if(targetKeys.length<NUTRIENTS.length)add('info','partial-targets','Only specified target elements are audited; unlisted elements are not independently verified');
  let quantities=amounts;
  if(quantities!==undefined){
    if(!Array.isArray(quantities)||quantities.length!==products.length)throw new RangeError('One gram amount per product is required');
    quantities.forEach((value,i)=>valid(value,'Product '+(i+1)+' grams'));
  }
  const blocked=issues.some(x=>x.severity==='error');
  let result=null;
  if(!blocked){
    result=quantities===undefined?optimizeRecipe({volumeL,sourceWater,targets,products,activeTargets:targetKeys}):{
      amounts:quantities,
      achieved:evaluateRecipe({volumeL,sourceWater,products,amounts:quantities})
    };
    for(const k of targetKeys){
      const achieved=result.achieved[k],goal=targets[k];
      const tolerance=Math.max(absoluteToleranceMgL,relativeTolerance*goal);
      if(Math.abs(achieved-goal)>tolerance)add('warning','target-miss',k+' differs from target by '+(achieved-goal).toFixed(2)+' mg/L',k);
    }
  }
  add('info','model-limitations','Mathematical mass balance only: verify product form, label basis, purity, compatibility, solubility, mixing order, pH and EC with independent measurements');
  return {ok:!issues.some(x=>x.severity==='error'||x.severity==='warning'),blocked,result,issues,checkedTargets:targetKeys};
}
