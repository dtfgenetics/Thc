#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'content','encyclopedia','visual-production-batches');
const indexPath=path.join(dir,'index.json');
const queuePath=path.join(root,'content','encyclopedia','visual-production-queue-v1.json');
const errors=[];
if(!fs.existsSync(indexPath)) errors.push('Batch index is missing.');
const index=errors.length?{batches:[]}:JSON.parse(fs.readFileSync(indexPath,'utf8'));
const batches=Array.isArray(index.batches)?index.batches:[];
const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
const expectedNeeded=(queue.items||[]).filter(x=>x.productionStatus==='brief_ready_raster_artwork_needed').length;
if(index.artworkNeededCount!==expectedNeeded) errors.push(`Expected ${expectedNeeded} artwork-needed lessons from queue; found ${index.artworkNeededCount}`);
if(index.batchSize!==24) errors.push(`Expected batch size 24; found ${index.batchSize}`);
const expectedBatchCount=Math.ceil(expectedNeeded/24);
if(index.batchCount!==expectedBatchCount) errors.push(`Expected ${expectedBatchCount} batches; found ${index.batchCount}`);
const seen=new Set();
let count=0;
for(const batch of batches){
  const file=path.join(root,batch.file||'');
  if(!fs.existsSync(file)){errors.push(`${batch.batchId}: batch file missing`);continue;}
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.batchId!==batch.batchId) errors.push(`${batch.batchId}: index/file ID mismatch`);
  if(data.status!=='production-ready-review-controlled') errors.push(`${batch.batchId}: invalid status`);
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>24) errors.push(`${batch.batchId}: invalid item count`);
  for(const item of data.items||[]){
    count++;
    if(seen.has(item.lessonId)) errors.push(`${item.lessonId}: appears in more than one batch`);
    seen.add(item.lessonId);
    if(!/^THC-ENC-\d{3}$/.test(item.lessonId)) errors.push(`${item.lessonId}: invalid lesson ID`);
    if(!/\.png$/i.test(item.targetFilename||'')) errors.push(`${item.lessonId}: target must be PNG`);
    if(!String(item.targetRepositoryPath||'').startsWith('site/wordpress/assets/infographics/')) errors.push(`${item.lessonId}: invalid target path`);
    if(!Array.isArray(item.accuracyRequirements)||item.accuracyRequirements.length<2) errors.push(`${item.lessonId}: insufficient accuracy requirements`);
    if(!Array.isArray(item.requiredLabels)||item.requiredLabels.length<4) errors.push(`${item.lessonId}: insufficient labels`);
    if(!Array.isArray(item.sourceAnchors)||item.sourceAnchors.length<2) errors.push(`${item.lessonId}: insufficient source anchors`);
    const reviews=item.requiredReviews||{};
    for(const key of ['science','accessibility','provenance','responsive','finalAssetQa']) if(reviews[key]!=='pending') errors.push(`${item.lessonId}: ${key} review must start pending`);
  }
}
if(count!==index.artworkNeededCount) errors.push(`Batch item total ${count} does not equal index artwork-needed count ${index.artworkNeededCount}`);
if(errors.length){
  console.error(`Visual production batch validation failed with ${errors.length} error(s):`);
  errors.slice(0,100).forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log(`Visual production batches PASS: ${count} unique lessons across ${batches.length} controlled batches; every asset remains review-pending.`);
