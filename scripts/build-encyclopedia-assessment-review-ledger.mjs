#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'review','encyclopedia-assessment-rationales'),out=path.join(root,'data','encyclopedia-assessment-review-ledger.json');
if(!fs.existsSync(dir)) throw new Error('Missing assessment review packets.');
const files=fs.readdirSync(dir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort(),rows=[],seen=new Set(),errors=[],decisions=new Set(['approved','changes_requested','rejected']);
const keys=['taughtByLesson','reasoningAccuracy','misconceptionHandling','measurementAlignment','evidenceBoundaryAlignment'];
for(const file of files){
  const p=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  for(const item of p.items||[]){
    if(seen.has(item.lessonId)) errors.push(item.lessonId+': duplicate'); seen.add(item.lessonId);
    const r=item.reviewInput||{},any=Object.values(r).some(v=>v!==null&&v!=='');
    if(!any){rows.push({lessonId:item.lessonId,sourcePacket:file,decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,checks:null});continue;}
    if(!decisions.has(r.decision)||!String(r.reviewerId||'').trim()||!String(r.reviewerName||'').trim()) errors.push(item.lessonId+': incomplete reviewer identity/decision');
    const checks=Object.fromEntries(keys.map(k=>[k,r[k]])); if(Object.values(checks).some(v=>typeof v!=='boolean')) errors.push(item.lessonId+': incomplete checks');
    rows.push({lessonId:item.lessonId,sourcePacket:file,decision:r.decision,reviewerId:String(r.reviewerId||'').trim()||null,reviewerName:String(r.reviewerName||'').trim()||null,reviewedAt:r.reviewedAt||null,reviewNotes:String(r.reviewNotes||'').trim()||null,checks});
  }
}
if(seen.size!==420) errors.push(`Expected 420 unique assessment review rows; found ${seen.size}`);
if(errors.length){errors.forEach(x=>console.error(' - '+x));process.exit(1);}
const output={schemaVersion:'1.0.0',artifactId:'thc-encyclopedia-assessment-review-ledger',generatedBy:'scripts/build-encyclopedia-assessment-review-ledger.mjs',boundary:'Durable validated reviewer-state projection. Blank rows are non-promoting. This builder never creates reviewer decisions.',summary:{lessonCount:rows.length,completed:rows.filter(x=>x.decision).length,approved:rows.filter(x=>x.decision==='approved').length,changesRequested:rows.filter(x=>x.decision==='changes_requested').length,rejected:rows.filter(x=>x.decision==='rejected').length},lessons:rows};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n'); console.log(JSON.stringify(output.summary,null,2));
