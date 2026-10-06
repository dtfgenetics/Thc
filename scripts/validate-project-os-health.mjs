#!/usr/bin/env node
import fs from 'node:fs';

const failure=JSON.parse(fs.readFileSync('data/project-os/failure-memory.json','utf8'));
const blockers=JSON.parse(fs.readFileSync('data/project-os/blocker-escalation.json','utf8'));
const slos=JSON.parse(fs.readFileSync('data/project-os/portfolio-slos.json','utf8'));
const errors=[];

if(failure.schemaVersion!==1||failure.registryId!=='project-os.failure-memory-v1') errors.push('invalid failure-memory header');
const fingerprints=new Set();
for(const [i,x] of (failure.entries||[]).entries()){
 if(!x.fingerprint) errors.push('failure entry '+i+' missing fingerprint');
 else if(fingerprints.has(x.fingerprint)) errors.push('duplicate failure fingerprint '+x.fingerprint);
 else fingerprints.add(x.fingerprint);
 if(!x.rootCause) errors.push('failure '+i+' missing rootCause');
 if(!Array.isArray(x.successfulRepairs)) errors.push('failure '+i+' successfulRepairs must be array');
 if(!Array.isArray(x.invalidatedWorkarounds)) errors.push('failure '+i+' invalidatedWorkarounds must be array');
}
if(blockers.schemaVersion!==1||blockers.registryId!=='project-os.blocker-escalation-v1') errors.push('invalid blocker header');
const blockerIds=new Set();
for(const [i,x] of (blockers.entries||[]).entries()){
 if(!x.blockerId) errors.push('blocker '+i+' missing blockerId');
 else if(blockerIds.has(x.blockerId)) errors.push('duplicate blockerId '+x.blockerId);
 else blockerIds.add(x.blockerId);
 if(!blockers.allowedTypes.includes(x.type)) errors.push('blocker '+i+' invalid type');
 if(!x.requiredAction) errors.push('blocker '+i+' missing requiredAction');
 if(typeof x.humanOnly!=='boolean') errors.push('blocker '+i+' humanOnly must be boolean');
}
if(slos.schemaVersion!==1||slos.sloId!=='project-os.portfolio-slo-v1') errors.push('invalid SLO header');
const sloIds=new Set();
for(const [i,x] of (slos.targets||[]).entries()){
 if(!x.id||sloIds.has(x.id)) errors.push('duplicate/missing SLO id at '+i);
 else sloIds.add(x.id);
 if(!['eq','gte','lte'].includes(x.operator)) errors.push('SLO '+x.id+' invalid operator');
 if(typeof x.metric!=='string'||!x.metric) errors.push('SLO '+x.id+' missing metric');
 if(!Number.isFinite(Number(x.target))) errors.push('SLO '+x.id+' invalid target');
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Project OS health registries valid');
