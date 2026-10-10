#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(), src=path.join(root,'data','encyclopedia-assessment-rationale-package.json'), outDir=path.join(root,'review','encyclopedia-assessment-rationales');
if(!fs.existsSync(src)) throw new Error('Missing assessment rationale package.');
const data=JSON.parse(fs.readFileSync(src,'utf8')); fs.mkdirSync(outDir,{recursive:true});
const preserved=new Map();
for(const file of fs.readdirSync(outDir).filter(x=>/^batch-\d{3}\.json$/i.test(x))){
  const packet=JSON.parse(fs.readFileSync(path.join(outDir,file),'utf8'));
  for(const item of packet.items||[]){
    const r=item.reviewInput||{};
    const q=Array.isArray(item.questionReviews)?item.questionReviews:[];
    if(Object.values(r).some(v=>v!==null&&v!=='' )||q.some(row=>Object.values(row.reviewInput||{}).some(v=>v!==null&&v!==''))) preserved.set(item.lessonId,{lesson:r,questions:q});
  }
}
// Validate all source identities before replacing any existing reviewer packets.
const rows=data.lessons||[], index=[];
const seenLessonIds=new Set();
for(const row of rows){
  if(!/^THC-ENC-\d{3,}$/.test(String(row.lessonId||''))) throw new Error('Invalid lesson ID in rationale review source.');
  if(seenLessonIds.has(row.lessonId)) throw new Error(`Duplicate rationale review lesson: ${row.lessonId}`);
  seenLessonIds.add(row.lessonId);
  const questionIds=(row.rationales||[]).map(r=>r.questionId);
  const expected=[1,2,3].map(n=>`${row.lessonId}-Q${n}`);
  if(questionIds.length!==3||expected.some((id,n)=>questionIds[n]!==id)){
    throw new Error(`${row.lessonId}: review packet requires exactly three ordered and unique Q1–Q3 rationales`);
  }
}

for(const file of fs.readdirSync(outDir)) if(/^batch-\d{3}\.(?:json|md)$/i.test(file)) fs.unlinkSync(path.join(outDir,file));
for(let start=0;start<rows.length;start+=20){
  const slice=rows.slice(start,start+20), n=String(Math.floor(start/20)+1).padStart(3,'0');
  const items=slice.map(row=>({
    lessonId:row.lessonId,title:row.title,canonicalFile:row.canonicalFile,
    prompts:row.prompts,rationales:row.rationales,sourceAnchors:row.sourceAnchors,evidenceLimits:row.evidenceLimits,
    reviewInput:preserved.get(row.lessonId)?.lesson||{decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,taughtByLesson:null,reasoningAccuracy:null,misconceptionHandling:null,measurementAlignment:null,evidenceBoundaryAlignment:null},
    questionReviews:(row.rationales||[]).map(rationale=>({
      questionId:rationale.questionId,
      reviewInput:preserved.get(row.lessonId)?.questions?.find(x=>x.questionId===rationale.questionId)?.reviewInput||{decision:null,reviewerId:null,reviewedAt:null,reviewNotes:null,reasoningAccuracy:null,alignmentWithPrompt:null,evidenceBoundaryAlignment:null}
    }))
  }));
  const packet={schemaVersion:'1.0.0',batchId:`ENC-ASSESS-REVIEW-${n}`,packetType:'assessment-rationale-independent-review-input',boundary:'Reviewer fields must be completed by a real independent reviewer. Blank fields are intentional and non-promoting.',decisionValues:['approved','changes_requested','rejected'],questionReviewRule:'Review all three question IDs separately; lesson-level approval must not substitute for question-level scientific and evidence review.',questionReviewCount:items.reduce((sum,item)=>sum+item.questionReviews.length,0),booleanReviewFields:['taughtByLesson','reasoningAccuracy','misconceptionHandling','measurementAlignment','evidenceBoundaryAlignment'],items};
  fs.writeFileSync(path.join(outDir,`batch-${n}.json`),JSON.stringify(packet,null,2)+'\n');
  index.push({batchId:packet.batchId,json:`review/encyclopedia-assessment-rationales/batch-${n}.json`,itemCount:items.length});
}
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify({schemaVersion:'1.0.0',batchCount:index.length,lessonCount:rows.length,batches:index},null,2)+'\n');
console.log(`Built ${index.length} assessment-rationale review packets covering ${rows.length} lessons; preserved reviewer input for ${preserved.size} lesson(s).`);
