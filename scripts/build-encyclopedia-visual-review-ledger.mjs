#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(), reviewDir=path.join(root,'review','encyclopedia-visuals'), out=path.join(root,'data','encyclopedia-visual-review-ledger.json');
if(!fs.existsSync(reviewDir)) throw new Error('Missing visual review packets.');
const files=fs.readdirSync(reviewDir).filter(x=>/^(?:batch-\d{3}|produced-review-\d{3})\.json$/i.test(x)).sort();
const rows=[],seen=new Set(),errors=[]; const decisions=new Set(['approved','changes_requested','rejected']);
for(const file of files){const packet=JSON.parse(fs.readFileSync(path.join(reviewDir,file),'utf8')); for(const item of packet.items||[]){
 if(seen.has(item.lessonId)) errors.push(`${item.lessonId}: duplicate`); seen.add(item.lessonId);
 const r=item.reviewInput||{}, any=Object.values(r).some(v=>v!==null&&v!=='');
 if(!any){rows.push({lessonId:item.lessonId,sourcePacket:file,decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,checks:null});continue;}
 if(!decisions.has(r.decision)||!String(r.reviewerId||'').trim()||!String(r.reviewerName||'').trim()) errors.push(`${item.lessonId}: incomplete reviewer identity/decision`);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||''))) errors.push(`${item.lessonId}: invalid reviewedAt`);
 if(String(r.reviewNotes||'').trim().length<40) errors.push(`${item.lessonId}: reviewNotes too short`);
 const checks={scienceAccuracy:r.scienceAccuracy,labelingAccuracy:r.labelingAccuracy,misconceptionSafety:r.misconceptionSafety,accessibilityQuality:r.accessibilityQuality,provenanceRights:r.provenanceRights,responsiveLegibility:r.responsiveLegibility};
 if(Object.values(checks).some(v=>typeof v!=='boolean')) errors.push(`${item.lessonId}: incomplete controlled checks`);
 if(r.decision==='approved'&&Object.values(checks).some(v=>v!==true)) errors.push(`${item.lessonId}: approval requires all checks true`);
 rows.push({lessonId:item.lessonId,sourcePacket:file,decision:r.decision,reviewerId:String(r.reviewerId||'').trim()||null,reviewerName:String(r.reviewerName||'').trim()||null,reviewedAt:r.reviewedAt||null,reviewNotes:String(r.reviewNotes||'').trim()||null,checks});
}}
if(seen.size!==420) errors.push(`Expected 420 unique visual review rows; found ${seen.size}`);
if(errors.length){errors.forEach(x=>console.error(' - '+x));process.exit(1);}
const output={schemaVersion:'1.0.0',artifactId:'thc-encyclopedia-visual-review-ledger',generatedBy:'scripts/build-encyclopedia-visual-review-ledger.mjs',boundary:'Durable validated reviewer-state projection. Blank rows are non-promoting. This builder never creates reviewer decisions.',summary:{lessonCount:rows.length,completed:rows.filter(x=>x.decision).length,approved:rows.filter(x=>x.decision==='approved').length,changesRequested:rows.filter(x=>x.decision==='changes_requested').length,rejected:rows.filter(x=>x.decision==='rejected').length},lessons:rows};
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n'); console.log(JSON.stringify(output.summary,null,2));
