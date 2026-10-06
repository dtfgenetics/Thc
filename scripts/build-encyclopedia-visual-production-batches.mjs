#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const queuePath=path.join(root,'content','encyclopedia','visual-production-queue-v1.json');
const outDir=path.join(root,'content','encyclopedia','visual-production-batches');
const batchSize=Math.max(1,Number(process.env.ENCYCLOPEDIA_VISUAL_BATCH_SIZE||24));
const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
const items=(queue.items||[])
  .flatMap(lesson=>(lesson.visualRoles||[])
    .filter(role=>role.status==='brief_ready_raster_artwork_needed')
    .map(role=>({...lesson,visualRole:role.role,visualOrdinal:role.ordinal})))
  // Spread early production across lessons and teaching roles instead of allowing
  // one high-priority lesson to consume ten consecutive task slots.
  .sort((a,b)=>a.visualOrdinal-b.visualOrdinal||b.visualPriorityScore-a.visualPriorityScore||a.number-b.number);

fs.mkdirSync(outDir,{recursive:true});
for(const name of fs.readdirSync(outDir)) if(/^batch-\d{3}\.(?:json|md)$/i.test(name)) fs.unlinkSync(path.join(outDir,name));

const batches=[];
for(let i=0;i<items.length;i+=batchSize){
  const slice=items.slice(i,i+batchSize);
  const batchNo=Math.floor(i/batchSize)+1;
  const batchId=`ENC-VIS-BATCH-${String(batchNo).padStart(3,'0')}`;
  const families={};
  for(const item of slice) families[item.visualFamily]=(families[item.visualFamily]||0)+1;
  const packet={
    schemaVersion:1,
    batchId,
    generatedAt:new Date().toISOString(),
    status:'production-ready-review-controlled',
    purpose:'Turn controlled encyclopedia visual briefs into lesson-specific raster teaching candidates without changing publication approval state.',
    reviewRule:'Every asset remains unapproved until science, accessibility, rights/provenance, rendering, and responsive review are explicitly recorded.',
    itemCount:slice.length,
    lessonCount:new Set(slice.map(x=>x.lessonId)).size,
    priorityRange:{
      high:Math.max(...slice.map(x=>x.visualPriorityScore)),
      low:Math.min(...slice.map(x=>x.visualPriorityScore))
    },
    visualFamilies:families,
    items:slice.map(item=>({
      queueId:item.queueId,
      lessonId:item.lessonId,
      number:item.number,
      title:item.title,
      visualType:item.visualType,
      visualFamily:item.visualFamily,
      visualPriorityScore:item.visualPriorityScore,
      visualRole:item.visualRole,
      visualOrdinal:item.visualOrdinal,
      teachingIntent:(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.teachingIntent,
      productionBrief:(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.productionBrief,
      purpose:item.purpose,
      accuracyRequirements:item.accuracyRequirements,
      requiredLabels:item.requiredLabels,
      misconceptionGuards:item.misconceptionGuards,
      sourceAnchors:item.sourceAnchors,
      altTextDraft:(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.altTextDraft,
      captionDraft:(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.captionDraft,
      targetFilename:`${item.lessonId}_${String(item.visualOrdinal).padStart(2,'0')}_${item.visualRole}.png`,
      targetRepositoryPath:`site/wordpress/assets/infographics/${item.lessonId}_${String(item.visualOrdinal).padStart(2,'0')}_${item.visualRole}.png`,
      requiredReviews:{
        science:'pending',
        accessibility:'pending',
        provenance:'pending',
        responsive:'pending',
        finalAssetQa:'pending'
      }
    }))
  };
  const jsonPath=path.join(outDir,`batch-${String(batchNo).padStart(3,'0')}.json`);
  fs.writeFileSync(jsonPath,JSON.stringify(packet,null,2)+'\n');
  const md=[
    `# ${batchId}`,
    '',
    `Visual tasks: **${slice.length}** · Lessons represented: **${packet.lessonCount}** · Priority: **${packet.priorityRange.high} → ${packet.priorityRange.low}**`,
    '',
    'This is a production packet, not approval. Each raster must pass independent science, accessibility, provenance/rights, responsive, and final asset QA.',
    '',
    ...slice.flatMap((item,idx)=>[
      `## ${idx+1}. ${item.lessonId} — ${item.title}`,
      '',
      `- Family: \`${item.visualFamily}\``,
      `- Visual role: \`${item.visualRole}\` (#${item.visualOrdinal})`,
      `- Priority: **${item.visualPriorityScore}**`,
      `- Teaching intent: ${(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.teachingIntent || ''}`,
      `- Production brief: ${(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.productionBrief || ''}`,
      `- Purpose: ${item.purpose}`,
      `- Required labels: ${item.requiredLabels.join(', ')}`,
      `- Accuracy requirements: ${item.accuracyRequirements.join(' | ')}`,
      `- Misconception guards: ${item.misconceptionGuards.join(' | ')}`,
      `- Sources: ${item.sourceAnchors.join(' | ')}`,
      `- Alt text draft: ${(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.altTextDraft || ''}`,
      `- Caption draft: ${(item.visualRoles||[]).find(role=>role.role===item.visualRole)?.captionDraft || ''}`,
      `- Target: \`site/wordpress/assets/infographics/${item.lessonId}_${String(item.visualOrdinal).padStart(2,'0')}_${item.visualRole}.png\``,
      ''
    ])
  ].join('\n');
  fs.writeFileSync(path.join(outDir,`batch-${String(batchNo).padStart(3,'0')}.md`),md+'\n');
  batches.push({
    batchId,
    file:`content/encyclopedia/visual-production-batches/batch-${String(batchNo).padStart(3,'0')}.json`,
    itemCount:slice.length,
    priorityRange:packet.priorityRange,
    visualFamilies:families,
    lessonIds:[...new Set(slice.map(x=>x.lessonId))],
    visualTaskIds:slice.map(x=>`${x.lessonId}:${x.visualRole}`)
  });
}
const index={
  schemaVersion:1,
  artifactId:'thc-encyclopedia-visual-production-batches-v1',
  generatedAt:new Date().toISOString(),
  source:'content/encyclopedia/visual-production-queue-v1.json',
  batchSize,
  artworkNeededCount:items.length,
  visualTaskCount:items.length,
  lessonCountWithGaps:new Set(items.map(x=>x.lessonId)).size,
  batchCount:batches.length,
  firstBatchLessonIds:batches[0]?.lessonIds||[],
  batches
};
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify(index,null,2)+'\n');
console.log(`Built ${batches.length} controlled visual production batches for ${items.length} missing visual roles across ${index.lessonCountWithGaps} lessons at ${batchSize} visual tasks/batch.`);
if(batches[0]) console.log(`First batch: ${batches[0].batchId} · ${batches[0].lessonIds.join(', ')}`);
