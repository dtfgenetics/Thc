#!/usr/bin/env node

export const DEFAULT_WEIGHTS=Object.freeze({
 severity:6,
 userImpact:5,
 productionExposure:5,
 unblockValue:4,
 ageDays:1,
 complexity:-3,
 collisionRisk:-5
});

export function computePriorityScore(priority,weights=DEFAULT_WEIGHTS){
 const p=priority||{};
 let score=0;
 for(const [key,weight] of Object.entries(weights)){
  const raw=Number(p[key]??0);
  if(!Number.isFinite(raw)) throw new Error('priority.'+key+' must be numeric');
  score+=raw*weight;
 }
 return Math.round(score);
}

export function scoreWorkItem(item,weights=DEFAULT_WEIGHTS){
 if(!item||typeof item!=='object') throw new Error('work item required');
 return {...item,priority:{...(item.priority||{}),score:computePriorityScore(item.priority,weights)}};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const input=process.argv[2] ? JSON.parse(process.argv[2]) : {};
 console.log(computePriorityScore(input));
}
