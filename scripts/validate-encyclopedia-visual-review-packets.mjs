#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const reviewDir=path.join(root,'review','encyclopedia-visuals');
const errors=[];
const decisions=new Set(['approved','changes_requested','rejected']);
const booleanFields=['scienceAccuracy','labelingAccuracy','misconceptionSafety','accessibilityQuality','provenanceRights','responsiveLegibility'];
const files=fs.existsSync(reviewDir)?fs.readdirSync(reviewDir).filter(x=>/^(?:batch-\d{3}|produced-review-\d{3})\.json$/i.test(x)).sort():[];
const indexPath=path.join(reviewDir,'index.json');
const index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath,'utf8')):{batches:[]};
let rows=0, productionBriefRows=0, existingRasterRows=0, completed=0, approved=0;
for(const file of files){
  const packet=JSON.parse(fs.readFileSync(path.join(reviewDir,file),'utf8'));
  if(packet.schemaVersion!=='1.0.0') errors.push(`${file}: schemaVersion mismatch`);
  if(!['independent-review-input','existing-raster-independent-review-input'].includes(packet.packetType)) errors.push(`${file}: packetType mismatch`);
  const existingRaster=packet.packetType==='existing-raster-independent-review-input';
  for(const item of packet.items||[]){
    rows++;
    if(existingRaster) existingRasterRows++; else productionBriefRows++;
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
      if(!existingRaster&&!item.machinePreflightPassed) errors.push(`${item.lessonId}: cannot approve with failed machine preflight`);
      if(existingRaster&&(!Array.isArray(item.candidateAssetPaths)||item.candidateAssetPaths.length<1)) errors.push(`${item.lessonId}: existing raster approval requires candidateAssetPaths`);
      if(Number(item.evidence?.claimEvidenceCount||0)<1) errors.push(`${item.lessonId}: cannot approve without claim evidence record`);
    }
  }
}
const expectedRows=(index.batches||[]).reduce((sum,b)=>sum+Number(b.itemCount||0),0);
if(rows!==expectedRows) errors.push(`Review row count must match generated review index ${expectedRows}; found ${rows}`);
if(Number(index.candidateCount||0)!==rows) errors.push(`Review index candidateCount must equal parsed review rows ${rows}.`);
if(Number(index.productionBriefReviewCount||0)!==productionBriefRows) errors.push(`Review index productionBriefReviewCount must equal ${productionBriefRows}.`);
if(Number(index.existingRasterReviewCount||0)!==existingRasterRows) errors.push(`Review index existingRasterReviewCount must equal ${existingRasterRows}.`);
if(rows<1 && (index.batches||[]).length>0) errors.push('Nonempty visual review batch index must contain at least one controlled review row.');
if(errors.length){
  console.error(`Visual review packet validation failed with ${errors.length} issue(s):`);
  errors.slice(0,200).forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log(`Visual review packets PASS: ${rows} total · ${productionBriefRows} production briefs · ${existingRasterRows} existing rasters · ${completed} completed reviews · ${approved} approved. Blank review fields remain allowed and non-promoting.`);
