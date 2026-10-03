import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { effectiveLessonAssessment } from './lib/encyclopedia-assessment-v2.mjs';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/current-controlled-registry.json'),'utf8'));
const topics=JSON.parse(fs.readFileSync(path.join(root,'configuration/encyclopedia-topics.json'),'utf8')).topics||[];
const topicByPart=new Map(topics.map(topic=>[Number(topic.part),topic]));

const canonicalLessons=readCanonicalEncyclopediaLessons(root);
if(canonicalLessons.length!==420){
  console.error(`Completion scorecard requires 420 canonical lessons; found ${canonicalLessons.length}.`);
  process.exit(1);
}
const lessonById=new Map(canonicalLessons.map(lesson=>[
  lesson.id,
  {...lesson,_file:lesson.__path}
]));
for(const lesson of canonicalLessons){
  if(lesson.__sourceKind!=='individual-canonical'){
    console.error(`${lesson.id}: scorecard must use individual canonical lesson files, found ${lesson.__sourceKind}.`);
    process.exit(1);
  }
}

const arr=v=>Array.isArray(v)?v:[];
const text=v=>String(v??'').trim();
const termsOf=l=>arr(l.terms).length?arr(l.terms):arr(l.termsToKnow);
const measureOf=l=>arr(l.measureAndRecord).length?arr(l.measureAndRecord):arr(l.measurements);
const measurementGuidanceComplete=l=>{
  const rows=measureOf(l);
  if(rows.length>=2) return true;
  if(rows.length!==1) return false;
  const row=rows[0];
  const value=typeof row==='string'?row:`${row?.field||''}: ${row?.requirement||''}`;
  const clean=String(value||'').trim();
  const wordCount=clean.split(/\s+/).filter(Boolean).length;
  const recordSegments=clean.split(/[;|]/).map(x=>x.trim()).filter(Boolean).length;
  return wordCount>=12 || recordSegments>=3;
};
const checksOf=l=>effectiveLessonAssessment(l).prompts;
const sourcesOf=l=>arr(l.sourceNotes).length?arr(l.sourceNotes):arr(l.evidence);
const visualsOf=l=>arr(l.visuals);
const expandEncRefs=value=>{
  const text=String(value??'');
  const ids=new Set(text.match(/THC-ENC-\d{3}/g)||[]);
  for(const match of text.matchAll(/THC-ENC-(\d{3})\s*[–—-]\s*(?:THC-ENC-)?(\d{3})/g)){
    const start=Number(match[1]), end=Number(match[2]);
    if(Number.isInteger(start)&&Number.isInteger(end)&&end>=start&&end-start<=419){
      for(let n=start;n<=end;n++) ids.add(`THC-ENC-${String(n).padStart(3,'0')}`);
    }
  }
  return [...ids];
};
const crossOf=l=>{
  if(typeof l.crossLinks==='string')return expandEncRefs(l.crossLinks);
  if(Array.isArray(l.crossLinks))return [...new Set(l.crossLinks.flatMap(expandEncRefs))];
  if(l.crossLinks&&typeof l.crossLinks==='object')return [
    ...arr(l.crossLinks.prerequisiteLessonIds),
    ...arr(l.crossLinks.relatedLessonIds),
    ...arr(l.crossLinks.toolIds),
    ...arr(l.crossLinks.sopIds),
    ...arr(l.crossLinks.downloadIds)
  ];
  return [];
};

function criterion(ok,weight,label){return {label,weight,ok:Boolean(ok),points:ok?weight:0}}
function scoreLesson(entry){
  const l=lessonById.get(entry.id)||{};
  const c=[
    criterion(text(l.objective||arr(l.learningObjectives)[0]).length>=24,8,'objective'),
    criterion(termsOf(l).length>=3,7,'terms'),
    criterion(arr(l.coreScience).length>=2||arr(l.sections?.mechanism).length>=2,12,'core science'),
    criterion(arr(l.cultivationRelevance).length>=1||arr(l.sections?.cultivationRelevance).length>=1,8,'cultivation relevance'),
    criterion(measurementGuidanceComplete(l)||arr(l.sections?.measurementAndRecords).length>=2,10,'measurement guidance'),
    criterion(arr(l.misconceptions).length>=2||arr(l.sections?.misconceptions).length>=2,7,'misconceptions'),
    criterion(arr(l.evidenceLimits).length>=1||text(l.evidenceLimits).length>=30||arr(l.sections?.evidenceLimits).length>=1,8,'evidence limits'),
    criterion(crossOf(l).length>=2,8,'cross-links'),
    criterion(sourcesOf(l).length>=2,12,'source notes / evidence'),
    criterion(visualsOf(l).some(v=>v?.assetId&&v?.qaStatus==='approved')||Boolean(l.approvedVisualAssetId),8,'approved teaching visual'),
    criterion(checksOf(l).length>=3,7,'lesson-specific assessment'),
    criterion(Boolean(l.assessmentDesign?.answerRationaleStatus&&l.assessmentDesign.answerRationaleStatus!=='pending_independent_review')||arr(l.assessment?.answerRationales).length>=checksOf(l).length&&checksOf(l).length>=3,3,'assessment rationale / completion'),
    criterion(Boolean(l.reviewControl||l.revision),2,'release control')
  ];
  const score=c.reduce((sum,x)=>sum+x.points,0);
  const contentLabels=new Set([
    'objective','terms','core science','cultivation relevance','measurement guidance',
    'misconceptions','evidence limits','cross-links','source notes / evidence','lesson-specific assessment'
  ]);
  const contentCriteria=c.filter(x=>contentLabels.has(x.label));
  const contentMaxScore=contentCriteria.reduce((sum,x)=>sum+x.weight,0);
  const contentScore=contentCriteria.reduce((sum,x)=>sum+x.points,0);
  const contentContractComplete=contentCriteria.every(x=>x.ok);
  const topic=topicByPart.get(Number(entry.part));
  const publicationAuthorized=l.reviewControl?.publicationAuthorized??l.publicationAuthorized??null;
  return {
    id:entry.id,number:entry.number,part:entry.part,topic:topic?.title||`Part ${entry.part}`,
    title:entry.title,file:l._file||null,score,maxScore:100,
    contentScore,contentMaxScore,contentContractComplete,
    readiness:score>=90?'production-candidate':score>=75?'needs-polish':score>=50?'incomplete':'major-gaps',
    publicationAuthorized,
    missing:c.filter(x=>!x.ok).map(x=>x.label),
    criteria:c
  };
}

const lessons=(registry.entries||[]).map(scoreLesson);
const counts={};
for(const row of lessons)counts[row.readiness]=(counts[row.readiness]||0)+1;
const average=Math.round(lessons.reduce((s,x)=>s+x.score,0)/Math.max(1,lessons.length));
const parts=topics.map(topic=>{
  const rows=lessons.filter(x=>x.part===Number(topic.part));
  return {
    part:Number(topic.part),title:topic.title,count:rows.length,
    averageScore:Math.round(rows.reduce((s,x)=>s+x.score,0)/Math.max(1,rows.length)),
    productionCandidates:rows.filter(x=>x.readiness==='production-candidate').length,
    majorGaps:rows.filter(x=>x.readiness==='major-gaps').length
  };
});
const output={
  schemaVersion:1,generatedAt:new Date().toISOString(),
  lessonCount:lessons.length,averageScore:average,readinessCounts:counts,
  scoringNote:'Overall readiness includes content plus downstream visual/review/release controls. contentScore/contentContractComplete isolate the learner-facing lesson-content contract and do not imply scientific approval or publication authorization.',
  parts,lessons
};
const out=path.join(root,'data/encyclopedia-completion-scorecard.json');
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia scorecard: ${lessons.length} lessons · average ${average}/100 · ${counts['production-candidate']||0} production candidates`);
