#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'review','encyclopedia-claim-evidence'),src=path.join(root,'data','encyclopedia-claim-evidence-candidates.json'),errors=[];
if(!fs.existsSync(src)) throw new Error('Missing claim-evidence candidate ledger.');
const expected=JSON.parse(fs.readFileSync(src,'utf8')).summary?.candidateClaimCount||0;
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort():[];
const decisions=new Set(['approved','changes_requested','rejected']),bools=['sourceIdentityVerified','sourceSupportsClaim','scopeApplicabilityAccurate','evidenceLimitAccurate','noOverclaim'];
let rows=0,completed=0,approved=0;const seen=new Set();
for(const file of files){
  const p=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')); if(p.packetType!=='claim-evidence-independent-review-input')errors.push(file+': packetType mismatch');
  for(const item of p.items||[]){
    rows++; if(seen.has(item.candidateId))errors.push(item.candidateId+': duplicate');seen.add(item.candidateId);
    if(!item.lessonId||!item.candidateClaim||(item.sourceReferenceIds||[]).length<1)errors.push(item.candidateId+': incomplete claim/source candidate');
    const r=item.reviewInput||{},any=Object.values(r).some(v=>v!==null&&v!=='');if(!any)continue;completed++;
    if(!decisions.has(r.decision))errors.push(item.candidateId+': invalid decision');
    if(!String(r.reviewerId||'').trim()||!String(r.reviewerName||'').trim())errors.push(item.candidateId+': reviewer identity required');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||'')))errors.push(item.candidateId+': invalid reviewedAt');
    if(String(r.reviewNotes||'').trim().length<40)errors.push(item.candidateId+': reviewNotes too short');
    for(const k of bools)if(typeof r[k]!=='boolean')errors.push(item.candidateId+`: ${k} must be boolean`);
    if(r.decision==='approved'){approved++;for(const k of bools)if(r[k]!==true)errors.push(item.candidateId+`: approval requires ${k}=true`);}
  }
}
if(rows!==expected)errors.push(`Expected ${expected} claim review rows; found ${rows}`);
if(errors.length){console.error(`Claim review packet validation failed with ${errors.length} issue(s):`);errors.slice(0,200).forEach(x=>console.error(' - '+x));process.exit(1);}
console.log(`Claim review packets PASS: ${rows} claims · ${completed} completed · ${approved} approved. Blank review fields remain non-promoting.`);
