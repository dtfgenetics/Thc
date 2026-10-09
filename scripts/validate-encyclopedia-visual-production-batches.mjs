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
const expectedNeeded=(queue.items||[]).reduce((sum,lesson)=>sum+(lesson.visualRoles||[]).filter(role=>role.status==='brief_ready_raster_artwork_needed').length,0);
const expectedTasks=new Map((queue.items||[]).flatMap(lesson=>(lesson.visualRoles||[])
  .filter(role=>role.status==='brief_ready_raster_artwork_needed')
  .map(role=>[`${lesson.lessonId}:${role.role}`,role])));
if(index.artworkNeededCount!==expectedNeeded) errors.push(`Expected ${expectedNeeded} missing visual-role tasks from queue; found ${index.artworkNeededCount}`);
const configuredBatchSize=Number(process.env.ENCYCLOPEDIA_VISUAL_BATCH_SIZE||24);
if(!Number.isInteger(configuredBatchSize)||configuredBatchSize<1||configuredBatchSize>100) errors.push('ENCYCLOPEDIA_VISUAL_BATCH_SIZE must be an integer from 1 to 100.');
if(index.batchSize!==configuredBatchSize) errors.push(`Expected batch size ${configuredBatchSize}; found ${index.batchSize}`);
const expectedBatchCount=Math.ceil(expectedNeeded/configuredBatchSize);
if(index.batchCount!==expectedBatchCount) errors.push(`Expected ${expectedBatchCount} batches; found ${index.batchCount}`);
if(index.visualTaskCount!==expectedNeeded) errors.push(`Index visualTaskCount must equal queue-derived task count ${expectedNeeded}; found ${index.visualTaskCount}`);
if(index.sourceVisualTasksNeeded!==queue.summary?.visualTasksNeeded) errors.push('Batch index sourceVisualTasksNeeded does not match queue summary.');
if(index.sourceLessonsWithVisualGaps!==queue.summary?.lessonsWithVisualGaps) errors.push('Batch index sourceLessonsWithVisualGaps does not match queue summary.');
if(index.lessonCountWithGaps!==queue.summary?.lessonsWithVisualGaps) errors.push('Batch lessonCountWithGaps does not match queue summary.');
const seen=new Set();
let count=0;
for(const batch of batches){
  const relative=String(batch.file||'');
  if(!/^content\/encyclopedia\/visual-production-batches\/batch-\d{3}\.json$/.test(relative)) {
    errors.push(`${batch.batchId}: batch file must be a controlled JSON path inside visual-production-batches`);
    continue;
  }
  const file=path.resolve(root,relative);
  if(!file.startsWith(path.resolve(dir)+path.sep)) {
    errors.push(`${batch.batchId}: batch file escapes production batch directory`);
    continue;
  }
  if(!fs.existsSync(file)){errors.push(`${batch.batchId}: batch file missing`);continue;}
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.batchId!==batch.batchId) errors.push(`${batch.batchId}: index/file ID mismatch`);
  if(data.status!=='production-ready-review-controlled') errors.push(`${batch.batchId}: invalid status`);
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>configuredBatchSize) errors.push(`${batch.batchId}: invalid item count`);
  for(const item of data.items||[]){
    count++;
    const taskId=`${item.lessonId}:${item.visualRole}`;
    if(seen.has(taskId)) errors.push(`${taskId}: appears in more than one batch`);
    const sourceRole=expectedTasks.get(taskId);
    if(!sourceRole) errors.push(`${taskId}: batch task has no matching missing-role brief in the canonical queue`);
    else if(sourceRole.ordinal!==item.visualOrdinal) errors.push(`${taskId}: batch ordinal differs from canonical queue`);
    seen.add(taskId);
    if(!/^THC-ENC-\d{3}$/.test(item.lessonId)) errors.push(`${item.lessonId}: invalid lesson ID`);
    if(!item.visualRole || !Number.isInteger(item.visualOrdinal) || item.visualOrdinal<1 || item.visualOrdinal>10) errors.push(`${item.lessonId}: missing or invalid visual role/ordinal`);
    if(!item.teachingIntent || !item.productionBrief) errors.push(`${item.lessonId}:${item.visualRole}: missing role-specific teaching intent or production brief`);
    if(!item.altTextDraft || !item.captionDraft) errors.push(`${item.lessonId}:${item.visualRole}: missing role-specific accessibility copy`);
    const expectedFilename=`${item.lessonId}_${String(item.visualOrdinal).padStart(2,'0')}_${item.visualRole}.png`;
    if(item.targetFilename!==expectedFilename) errors.push(`${item.lessonId}:${item.visualRole}: target filename does not match controlled role identity`);
    if(item.targetRepositoryPath!==`site/wordpress/assets/infographics/${expectedFilename}`) errors.push(`${item.lessonId}:${item.visualRole}: invalid controlled target path`);
    if(!Array.isArray(item.accuracyRequirements)||item.accuracyRequirements.length<2) errors.push(`${item.lessonId}: insufficient accuracy requirements`);
    if(!Array.isArray(item.requiredLabels)||item.requiredLabels.length<4) errors.push(`${item.lessonId}: insufficient labels`);
    if(!Array.isArray(item.sourceAnchors)||item.sourceAnchors.length<2) errors.push(`${item.lessonId}: insufficient source anchors`);
    const reviews=item.requiredReviews||{};
    for(const key of ['science','accessibility','provenance','responsive','finalAssetQa']) if(reviews[key]!=='pending') errors.push(`${item.lessonId}: ${key} review must start pending`);
  }
}
if(count!==index.artworkNeededCount) errors.push(`Batch item total ${count} does not equal index artwork-needed count ${index.artworkNeededCount}`);
for(const taskId of expectedTasks.keys()) if(!seen.has(taskId)) errors.push(`${taskId}: missing from controlled visual batches`);
if(batches.length>0){
  const firstFile=path.join(root,batches[0].file||'');
  if(fs.existsSync(firstFile)){
    const first=JSON.parse(fs.readFileSync(firstFile,'utf8'));
    const firstLessons=new Set((first.items||[]).map(item=>item.lessonId));
    const firstRoles=new Set((first.items||[]).map(item=>item.visualRole));
    if(expectedNeeded>=configuredBatchSize && firstLessons.size<Math.min(8,configuredBatchSize)) errors.push(`First production batch is insufficiently lesson-diverse: ${firstLessons.size} unique lessons.`);
    if(expectedNeeded>=configuredBatchSize && firstRoles.size<1) errors.push('First production batch must contain at least one controlled visual role.');
  }
}
if(errors.length){
  console.error(`Visual production batch validation failed with ${errors.length} error(s):`);
  errors.slice(0,100).forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log(`Visual production batches PASS: ${count} unique lesson/visual-role tasks across ${batches.length} controlled batches; every asset remains review-pending.`);
