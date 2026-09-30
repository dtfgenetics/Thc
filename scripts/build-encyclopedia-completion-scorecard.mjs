import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/current-controlled-registry.json'),'utf8'));
const topics=JSON.parse(fs.readFileSync(path.join(root,'configuration/encyclopedia-topics.json'),'utf8')).topics||[];
const topicByPart=new Map(topics.map(topic=>[Number(topic.part),topic]));

const lessonById=new Map();
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}};
const walk=dir=>{
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.isFile()&&entry.name.endsWith('.json')){
      const json=readJson(file);
      if(!json)continue;
      if(/^THC-ENC-\d{3,}$/.test(json.id||'')) lessonById.set(json.id,{...json,_file:path.relative(root,file)});
      for(const lesson of Array.isArray(json.lessons)?json.lessons:[]){
        if(/^THC-ENC-\d{3,}$/.test(lesson.id||'')) lessonById.set(lesson.id,{...lesson,_file:path.relative(root,file)});
      }
    }
  }
};
walk(path.join(root,'content/encyclopedia'));

const arr=v=>Array.isArray(v)?v:[];
const text=v=>String(v??'').trim();
const termsOf=l=>arr(l.terms).length?arr(l.terms):arr(l.termsToKnow);
const measureOf=l=>arr(l.measureAndRecord).length?arr(l.measureAndRecord):arr(l.measurements);
const checksOf=l=>arr(l.knowledgeCheck).length?arr(l.knowledgeCheck):arr(l.assessment?.knowledgeCheck);
const sourcesOf=l=>arr(l.sourceNotes).length?arr(l.sourceNotes):arr(l.evidence);
const visualsOf=l=>arr(l.visuals);
const crossOf=l=>{
  if(typeof l.crossLinks==='string')return l.crossLinks.match(/THC-ENC-\d{3}/g)||[];
  if(Array.isArray(l.crossLinks))return l.crossLinks;
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
    criterion(measureOf(l).length>=2||arr(l.sections?.measurementAndRecords).length>=2,10,'measurement guidance'),
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
  const topic=topicByPart.get(Number(entry.part));
  const publicationAuthorized=l.reviewControl?.publicationAuthorized??l.publicationAuthorized??null;
  return {
    id:entry.id,number:entry.number,part:entry.part,topic:topic?.title||`Part ${entry.part}`,
    title:entry.title,file:l._file||null,score,maxScore:100,
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
  scoringNote:'A readiness score measures completion of the THC lesson contract; it is not a scientific-quality rating or publication authorization.',
  parts,lessons
};
const out=path.join(root,'data/encyclopedia-completion-scorecard.json');
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia scorecard: ${lessons.length} lessons · average ${average}/100 · ${counts['production-candidate']||0} production candidates`);
