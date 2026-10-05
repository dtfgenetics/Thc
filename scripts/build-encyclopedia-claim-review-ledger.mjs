#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'review','encyclopedia-claim-evidence'),src=path.join(root,'data','encyclopedia-claim-evidence-candidates.json'),out=path.join(root,'data','encyclopedia-claim-review-ledger.json');
if(!fs.existsSync(dir)||!fs.existsSync(src))throw new Error('Missing claim review packets or candidate ledger.');
const expected=JSON.parse(fs.readFileSync(src,'utf8')).summary?.candidateClaimCount||0,files=fs.readdirSync(dir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort(),rows=[],seen=new Set(),errors=[],decisions=new Set(['approved','changes_requested','rejected']);
const keys=['sourceIdentityVerified','sourceSupportsClaim','scopeApplicabilityAccurate','evidenceLimitAccurate','noOverclaim'];
for(const file of files){
  const p=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  for(const item of p.items||[]){
    if(seen.has(item.candidateId))errors.push(item.candidateId+': duplicate');seen.add(item.candidateId);const r=item.reviewInput||{},any=Object.values(r).some(v=>v!==null&&v!=='');
    if(!any){rows.push({candidateId:item.candidateId,lessonId:item.lessonId,sourcePacket:file,decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,checks:null});continue;}
    if(!decisions.has(r.decision)||!String(r.reviewerId||'').trim()||!String(r.reviewerName||'').trim())errors.push(item.candidateId+': incomplete reviewer identity/decision');
    const checks=Object.fromEntries(keys.map(k=>[k,r[k]]));if(Object.values(checks).some(v=>typeof v!=='boolean'))errors.push(item.candidateId+': incomplete checks');
    rows.push({candidateId:item.candidateId,lessonId:item.lessonId,sourcePacket:file,decision:r.decision,reviewerId:String(r.reviewerId||'').trim()||null,reviewerName:String(r.reviewerName||'').trim()||null,reviewedAt:r.reviewedAt||null,reviewNotes:String(r.reviewNotes||'').trim()||null,checks});
  }
}
if(seen.size!==expected)errors.push(`Expected ${expected} unique claim review rows; found ${seen.size}`);if(errors.length){errors.forEach(x=>console.error(' - '+x));process.exit(1);}
const byLesson={};for(const row of rows){byLesson[row.lessonId]??={claimCount:0,completed:0,approved:0,changesRequested:0,rejected:0};const s=byLesson[row.lessonId];s.claimCount++;if(row.decision)s.completed++;if(row.decision==='approved')s.approved++;if(row.decision==='changes_requested')s.changesRequested++;if(row.decision==='rejected')s.rejected++;}
const output={schemaVersion:'1.0.0',artifactId:'thc-encyclopedia-claim-review-ledger',generatedBy:'scripts/build-encyclopedia-claim-review-ledger.mjs',boundary:'Durable claim-level reviewer-state projection. Blank rows are non-promoting. This builder never creates reviewer decisions.',summary:{claimCount:rows.length,completed:rows.filter(x=>x.decision).length,approved:rows.filter(x=>x.decision==='approved').length,changesRequested:rows.filter(x=>x.decision==='changes_requested').length,rejected:rows.filter(x=>x.decision==='rejected').length},lessonSummary:byLesson,claims:rows};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output.summary,null,2));
