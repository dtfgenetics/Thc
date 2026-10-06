#!/usr/bin/env node
import fs from 'node:fs';

const queuePath=process.argv[2]||'data/project-os/work-queue.json';
const q=JSON.parse(fs.readFileSync(queuePath,'utf8'));
const errors=[];
const ids=new Set();
const branches=new Map();
const active=new Set(['claimed','in_progress','review','release','live_verification']);
const validStates=new Set(['queued','claimed','in_progress','blocked','review','release','live_verification','done','failed','superseded']);
const nowValue=process.env.PROJECT_OS_NOW||new Date().toISOString();
const now=Date.parse(nowValue);
if(Number.isNaN(now)) errors.push('PROJECT_OS_NOW is not a valid ISO timestamp');

for(const [i,x] of (q.items||[]).entries()){
 const p='items['+i+']';
 if(!x.workItemId) errors.push(p+' missing workItemId');
 if(ids.has(x.workItemId)) errors.push('duplicate workItemId '+x.workItemId);
 ids.add(x.workItemId);
 if(!x.project||!x.ownerRepo) errors.push(p+' missing project/ownerRepo');
 if(!validStates.has(x.state)) errors.push(p+' invalid state');
 if(!Array.isArray(x.dependencies)) errors.push(p+' missing dependencies');
 if(!Array.isArray(x.acceptanceCriteria)||!x.acceptanceCriteria.length) errors.push(p+' missing acceptanceCriteria');
 if(active.has(x.state)&&x.branch){
  if(branches.has(x.branch)) errors.push('active branch collision '+x.branch);
  branches.set(x.branch,x.workItemId);
 }
 if(['claimed','in_progress'].includes(x.state)){
  if(!x.lease) errors.push(p+' active state requires lease');
  else {
   if(!x.lease.worker) errors.push(p+' lease missing worker');
   if(!x.lease.expiresAt) errors.push(p+' lease missing expiresAt');
   else {
    const expires=Date.parse(x.lease.expiresAt);
    if(Number.isNaN(expires)) errors.push(p+' lease expiresAt invalid');
    else if(!Number.isNaN(now)&&expires<=now) errors.push(p+' active state has expired lease');
   }
  }
 }
 if(x.state==='done'&&(x.acceptanceCriteria||[]).some(a=>!['passed','waived'].includes(a.status))) errors.push(p+' done with unmet acceptance criteria');
}
for(const x of q.items||[]) for(const dep of x.dependencies||[]) if(!ids.has(dep)) errors.push(x.workItemId+' missing dependency '+dep);
if(q.schemaVersion!==1) errors.push('schemaVersion must be 1');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Project OS work queue valid: '+q.items.length+' item(s)');
