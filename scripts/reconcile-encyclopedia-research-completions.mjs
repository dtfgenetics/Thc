#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),read=p=>JSON.parse(fs.readFileSync(p,'utf8')),arr=x=>Array.isArray(x)?x:[];
const leases=read(path.join(root,'content/encyclopedia/evidence/research-work-leases.json')).leases||[];
const queue=read(path.join(root,'data/encyclopedia-research-work-queue.json'));
const units=new Map(arr(queue.workUnits).map(x=>[x.workUnitId,x]));
const evDir=path.join(root,'content/encyclopedia/evidence');
const evidence=fs.readdirSync(evDir).filter(n=>/^evidence-batch-\d+\.json$/.test(n)).flatMap(n=>arr(read(path.join(evDir,n)).claimEvidence));
const upstream=process.env.THC_DATASET_RAG_CLAIMS;
const claims=upstream&&fs.existsSync(upstream)?arr(read(upstream).claims):[];
const bySha=new Map(claims.map(x=>[x.claim_sha256,x]));
const errors=[];
for(const lease of leases.filter(x=>x.status==='completed')){
 const unit=units.get(lease.workUnitId),out=lease.outcome||{};
 if(!unit){errors.push(lease.workUnitId+': missing work unit');continue}
 if(out.type==='reviewed_claim_binding'){
  if(!upstream||!fs.existsSync(upstream)){errors.push(lease.workUnitId+': upstream reviewed claims artifact required');continue}
  const claim=bySha.get(out.reference);
  if(!claim){errors.push(lease.workUnitId+': SHA missing from reviewed claims artifact');continue}
  if(!evidence.some(e=>e.lessonId===unit.lessonId&&e.datasetClaimSha256===out.reference&&e.datasetSourceId===claim.source_id))errors.push(lease.workUnitId+': reviewed SHA not bound to correct lesson evidence');
 }else if(out.type==='documented_limitation'){
  const num=Number(unit.lessonId.slice(-3)),vol=String(Math.ceil(num/20)).padStart(2,'0');
  const p=path.join(root,'content/encyclopedia',`volume-${vol}`,'lessons',unit.lessonId.toLowerCase()+'.json');
  if(!fs.existsSync(p)){errors.push(lease.workUnitId+': canonical lesson missing');continue}
  const l=read(p),limits=JSON.stringify(l.evidenceLimits||[]);
  if(!out.reference||!limits.includes(out.reference))errors.push(lease.workUnitId+': limitation reference not found in lesson evidenceLimits');
 }else if(out.type==='no_source_decision'){
  if(!out.reference||!String(out.reference).trim())errors.push(lease.workUnitId+': documented no-source decision reference required');
 }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Research completion reconciliation PASS: '+leases.filter(x=>x.status==='completed').length+' completed leases checked');
