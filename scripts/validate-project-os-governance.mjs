#!/usr/bin/env node
import fs from 'node:fs';

export function validateGovernance({research,security,archival}){
 const errors=[];
 if(research.schemaVersion!==1||research.registryId!=='project-os.research-handoffs-v1') errors.push('invalid research handoff header');
 const handoffIds=new Set();
 for(const [i,x] of (research.entries||[]).entries()){
  if(!x.handoffId||handoffIds.has(x.handoffId)) errors.push('duplicate/missing handoffId at '+i);
  else handoffIds.add(x.handoffId);
  if(!x.workItemId) errors.push('research handoff '+i+' missing workItemId');
  if(!research.allowedStates.includes(x.state)) errors.push('research handoff '+i+' invalid state');
  if(!x.question||!x.deliverable) errors.push('research handoff '+i+' missing question/deliverable');
 }
 if(security.schemaVersion!==1||security.registryId!=='project-os.security-maintenance-v1') errors.push('invalid security maintenance header');
 const repos=new Set();
 for(const [i,x] of (security.repositories||[]).entries()){
  if(!x.repo||repos.has(x.repo)) errors.push('duplicate/missing security repo at '+i);
  else repos.add(x.repo);
  if(!['evidence-required','external-verification-required','verified','blocked'].includes(x.state)) errors.push('security repo '+i+' invalid state');
  if(!Array.isArray(x.evidence)) errors.push('security repo '+i+' evidence must be array');
  else if(x.state==='verified' && x.evidence.length===0) errors.push('security repo '+x.repo+' cannot be verified without evidence');
 }
 if(archival.schemaVersion!==1||archival.registryId!=='project-os.archival-readiness-v1') errors.push('invalid archival readiness header');
 for(const [i,x] of (archival.candidates||[]).entries()){
  if(!x.repo) errors.push('archive candidate '+i+' missing repo');
  if(!['blocked','evaluating','ready','archived'].includes(x.state)) errors.push('archive candidate '+i+' invalid state');
  if(typeof x.gates!=='object'||Array.isArray(x.gates)||x.gates===null) errors.push('archive candidate '+i+' gates must be object');
  if(x.state==='ready'){
   for(const gate of archival.requiredGates||[]){
    const g=x.gates?.[gate];
    if(!g||g.status!=='passed'||!g.evidence) errors.push(x.repo+' ready without passed evidence for '+gate);
   }
  }
 }
 return errors;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const research=JSON.parse(fs.readFileSync('data/project-os/research-handoffs.json','utf8'));
 const security=JSON.parse(fs.readFileSync('data/project-os/security-maintenance.json','utf8'));
 const archival=JSON.parse(fs.readFileSync('data/project-os/archival-readiness.json','utf8'));
 const errors=validateGovernance({research,security,archival});
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS governance registries valid');
}
