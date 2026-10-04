#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const reviewDir=path.join(root,'review','encyclopedia-visuals');
const errors=[];
const decisions=new Set(['approved','changes_requested','rejected']);
const booleanFields=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'];
const files=fs.existsSync(reviewDir)?fs.readdirSync(reviewDir).filter(x=>/^batch-\d{3}\.json$/i.test(x)).sort():[];
let rows=0, completed=0, approved=0;
for(const file of files){
  const packet=JSON.parse(fs.readFileSync(path.join(reviewDir,file),'utf8'));
  if(packet.schemaVersion!=='1.0.0') errors.push(`${file}: schemaVersion mismatch`);
  if(packet.packetType!=='independent-review-input') errors.push(`${file}: packetType mismatch`);
  for(const item of packet.items||[]){
    rows++;
    const r=item.reviewInput||{};
    const any=Object.values(r).some(v=>v!==null&&v!=='');
    if(!any) continue;
    completed++;
    if(!decisions.has(r.decision)) errors.push(`${item.lessonId}: invalid decision`);
    if(!String(r.reviewerId||'').trim()) errors.push(`${item.lessonId}: reviewerId required when review is started`);
    if(!String(r.reviewerName||'').trim()) errors.push(`${item.lessonId}: reviewerName required when review is started`);
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(r.reviewedAt||''))) errors.push(`${item.lessonId}: reviewedAt must be UTC ISO 8601`);
    if(String(r.reviewNotes||'').trim().length<40) errors.push(`${item.lessonId}: reviewNotes must be at least 40 characters`);
    for(const key of booleanFields) if(typeof r[key]!=='boolean') errors.push(`${item.lessonId}: ${key} must be true/false for completed review`);
    if(r.decision==='approved'){
      approved++;
      for(const key of booleanFields) if(r[key]!==true) errors.push(`${item.lessonId}: approved review requires ${key}=true`);
      if(!item.machinePreflightPassed) errors.push(`${item.lessonId}: cannot approve with failed machine preflight`);
      if(Number(item.evidence?.claimEvidenceCount||0)<1) errors.push(`${item.lessonId}: cannot approve without claim evidence record`);
    }
  }
}
if(rows!==372) errors.push(`Expected 372 review rows; found ${rows}`);
if(errors.length){
  console.error(`Visual review packet validation failed with ${errors.length} issue(s):`);
  errors.slice(0,200).forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log(`Visual review packets PASS: ${rows} candidates · ${completed} completed reviews · ${approved} approved. Blank review fields remain allowed and non-promoting.`);
