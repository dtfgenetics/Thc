#!/usr/bin/env node
import fs from 'node:fs';

export function evaluateSlo(target,metrics){
 const value=Number(metrics[target.metric]??NaN);
 if(!Number.isFinite(value)) return {id:target.id,status:'unknown',value:null,target:target.target};
 let pass=false;
 if(target.operator==='eq') pass=value===Number(target.target);
 else if(target.operator==='gte') pass=value>=Number(target.target);
 else if(target.operator==='lte') pass=value<=Number(target.target);
 else throw new Error('unsupported operator '+target.operator);
 return {id:target.id,status:pass?'pass':'fail',value,target:target.target};
}

export function buildHealth({queue,failureMemory,blockers,slos,metrics}){
 const active=(queue.items||[]).filter(x=>!['done','superseded'].includes(x.state));
 const failed=(queue.items||[]).filter(x=>x.state==='failed');
 const blocked=(queue.items||[]).filter(x=>x.state==='blocked'||x.blocker);
 const sloResults=(slos.targets||[]).map(t=>evaluateSlo(t,metrics));
 const counts={};
 for(const x of queue.items||[]) counts[x.state]=(counts[x.state]||0)+1;
 return {
  schemaVersion:1,
  generatedAt:metrics.generatedAt||new Date().toISOString(),
  queue:{total:(queue.items||[]).length,active:active.length,failed:failed.length,blocked:blocked.length,byState:counts},
  failureMemory:{entries:(failureMemory.entries||[]).length,recurring:(failureMemory.entries||[]).filter(x=>(x.occurrences||0)>1).length},
  blockers:{open:(blockers.entries||[]).filter(x=>x.state!=='resolved').length,humanOnly:(blockers.entries||[]).filter(x=>x.humanOnly&&x.state!=='resolved').length},
  slos:{pass:sloResults.filter(x=>x.status==='pass').length,fail:sloResults.filter(x=>x.status==='fail').length,unknown:sloResults.filter(x=>x.status==='unknown').length,results:sloResults}
 };
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const queue=JSON.parse(fs.readFileSync('data/project-os/work-queue.json','utf8'));
 const failureMemory=JSON.parse(fs.readFileSync('data/project-os/failure-memory.json','utf8'));
 const blockers=JSON.parse(fs.readFileSync('data/project-os/blocker-escalation.json','utf8'));
 const slos=JSON.parse(fs.readFileSync('data/project-os/portfolio-slos.json','utf8'));
 const metricsPath=process.argv[2]||'data/project-os/portfolio-metrics.json';
 const metrics=fs.existsSync(metricsPath)?JSON.parse(fs.readFileSync(metricsPath,'utf8')):{};
 const report=buildHealth({queue,failureMemory,blockers,slos,metrics});
 console.log(JSON.stringify(report,null,2));
}
