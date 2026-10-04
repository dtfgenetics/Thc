#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const arr=v=>Array.isArray(v)?v:[];
const txt=v=>String(v??'').trim();
const outPath=path.join(root,'data','encyclopedia-quality-scorecard.json');

const registry=read('content/encyclopedia/current-controlled-registry.json');
const completion=read('data/encyclopedia-completion-scorecard.json');
const evidence=read('data/encyclopedia-evidence-tracking.json');
const sourceQueue=read('data/encyclopedia-source-resolution-queue.json');
const rationales=read('data/encyclopedia-assessment-rationale-package.json');
const visuals=read('content/encyclopedia/visual-production-queue-v1.json');
const evidencePriority=read('data/encyclopedia-evidence-priority.json');
const practical=fs.existsSync(path.join(root,'content','encyclopedia','downloads','registry.json'))
  ? read('content/encyclopedia/downloads/registry.json')
  : {resources:[]};

const lessons=readCanonicalEncyclopediaLessons(root);
if(lessons.length!==420) throw new Error('Quality scorecard requires 420 canonical lessons; found '+lessons.length);
const canonicalById=new Map(lessons.map(x=>[x.id,x]));
const mapById=rows=>new Map(arr(rows).map(x=>[x.id||x.lessonId,x]));
const completionById=mapById(completion.lessons);
const evidenceById=mapById(evidence.lessons);
const sourceById=mapById(sourceQueue.lessons);
const rationaleById=mapById(rationales.lessons);
const visualById=mapById(visuals.items);
const priorityById=mapById(evidencePriority.lessons);

const practicalCount=new Map();
for(const resource of arr(practical.resources)){
  for(const id of arr(resource.lessonIds)) practicalCount.set(id,(practicalCount.get(id)||0)+1);
}

function crossLinkCount(lesson){
  const v=lesson?.crossLinks;
  if(Array.isArray(v)) return v.length;
  if(typeof v==='string') return (v.match(/THC-ENC-\d{3}/g)||[]).length;
  if(v&&typeof v==='object'){
    return ['prerequisiteLessonIds','relatedLessonIds','toolIds','sopIds','downloadIds']
      .reduce((n,key)=>n+arr(v[key]).length,0);
  }
  return 0;
}

function searchMetadataScore(lesson){
  let points=0;
  const terms=arr(lesson?.terms).length?arr(lesson.terms):arr(lesson?.termsToKnow);
  if(terms.length>=3) points+=3;
  if(txt(lesson?.objective).length>=24||arr(lesson?.learningObjectives).length) points+=2;
  if(txt(lesson?.slug).length||txt(lesson?.route).length) points+=2;
  if(arr(lesson?.synonyms).length||arr(lesson?.aliases).length||arr(lesson?.keywords).length) points+=2;
  if(crossLinkCount(lesson)>=2) points+=1;
  return points;
}

function dimension(name,score,max,details={}){
  const bounded=Math.max(0,Math.min(max,Number(score)||0));
  return {name,score:bounded,max,complete:bounded===max,...details};
}

const rows=arr(registry.entries).map(entry=>{
  const l=canonicalById.get(entry.id)||{};
  const c=completionById.get(entry.id)||{};
  const e=evidenceById.get(entry.id)||{};
  const s=sourceById.get(entry.id)||{};
  const r=rationaleById.get(entry.id)||{};
  const v=visualById.get(entry.id)||{};
  const p=priorityById.get(entry.id)||{};

  const evidenceCount=Number(e?.evidence?.claimEvidenceCount||0);
  const evidenceReviewed=['independent_science_review_complete','approved'].includes(String(e?.evidence?.reviewState||''));
  const sourcesResolved=['authority_links_available_claim_review_pending','source_traceable_authority_review_pending'].includes(String(s.resolutionState||''));
  const approvedVisual=Boolean(v.approvedAssetId)&&v.assetQaStatus==='approved';
  const rationaleReviewed=['approved','independent_review_complete'].includes(String(r.reviewState||''));
  const publicationAuthorized=Boolean(c.publicationAuthorized||e?.publicationState?.publicationAuthorized);
  const contentScore=Math.round(20*Math.min(1,Number(c.contentScore||0)/Math.max(1,Number(c.contentMaxScore||1))));
  const sourceRatio=Number(s.evidenceReferenceCount||0)>0
    ? Number(s.traceableReferenceCount||0)/Math.max(1,Number(s.evidenceReferenceCount||0))
    : 0;
  const evidenceScore=Math.min(20,(evidenceCount>0?8:0)+(sourcesResolved?6:Math.round(6*sourceRatio))+(evidenceReviewed?6:0));
  const visualScore=approvedVisual?15:(Boolean(v.queueId)?6:0);
  const assessmentScore=Math.min(10,(arr(r.prompts).length>=3?4:0)+(arr(r.rationales).length>=arr(r.prompts).length&&arr(r.prompts).length>=3?3:0)+(rationaleReviewed?3:0));
  const knowledgeScore=Math.min(10,(crossLinkCount(l)>=2?5:crossLinkCount(l)>0?2:0)+(practicalCount.get(entry.id)>0?3:0)+(arr(l.relatedTools).length||arr(l.tools).length?2:0));
  const searchScore=searchMetadataScore(l);
  const releaseScore=(publicationAuthorized?8:0)+(Boolean(l.reviewControl||l.revision)?2:0);
  const riskScore=Number(p.riskScore||0);

  const dims=[
    dimension('content',contentScore,20),
    dimension('evidence',evidenceScore,20,{claimEvidenceCount:evidenceCount,sourcesResolved,evidenceReviewed}),
    dimension('visual',visualScore,15,{approvedVisual}),
    dimension('assessment',assessmentScore,10,{rationaleReviewed}),
    dimension('knowledge_graph',knowledgeScore,10,{crossLinkCount:crossLinkCount(l),practicalResourceCount:practicalCount.get(entry.id)||0}),
    dimension('search_discovery',searchScore,10),
    dimension('release_control',releaseScore,10,{publicationAuthorized}),
    dimension('maintenance',5-(riskScore>=15?3:riskScore>=8?2:riskScore>=4?1:0),5,{evidenceRiskScore:riskScore})
  ];
  const score=dims.reduce((n,d)=>n+d.score,0);
  const missing=dims.filter(d=>!d.complete).map(d=>d.name);
  const blockers=[];
  if(!c.contentContractComplete) blockers.push('content_contract');
  if(!evidenceCount) blockers.push('claim_evidence');
  if(!sourcesResolved) blockers.push('source_resolution');
  if(!approvedVisual) blockers.push('teaching_visual');
  if(!rationaleReviewed) blockers.push('assessment_review');
  if(!publicationAuthorized) blockers.push('publication_authorization');

  const impact=(100-score)+(riskScore*2)+(blockers.length*4);
  return {
    id:entry.id,number:entry.number,part:entry.part,title:entry.title,
    score,maxScore:100,
    grade:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F',
    dimensions:dims,missing,blockers,
    evidenceRiskScore:riskScore,
    repairPriorityScore:impact,
    nextActions:[
      ...(!c.contentContractComplete?['repair_content_contract']:[]),
      ...(!evidenceCount?['map_claim_evidence']:[]),
      ...(!sourcesResolved?['resolve_sources']:[]),
      ...(!approvedVisual?['produce_teaching_visual']:[]),
      ...(!rationaleReviewed?['review_assessment_rationales']:[]),
      ...(!publicationAuthorized?['independent_release_review']:[])
    ]
  };
});

const ranked=[...rows].sort((a,b)=>b.repairPriorityScore-a.repairPriorityScore||a.number-b.number);
const byPart=[...new Set(rows.map(x=>x.part))].sort((a,b)=>a-b).map(part=>{
  const r=rows.filter(x=>x.part===part);
  return {
    part,lessonCount:r.length,
    averageScore:Math.round(r.reduce((n,x)=>n+x.score,0)/Math.max(1,r.length)),
    below80:r.filter(x=>x.score<80).length,
    below60:r.filter(x=>x.score<60).length
  };
});
const missingCounts={};
for(const row of rows) for(const m of row.missing) missingCounts[m]=(missingCounts[m]||0)+1;

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-quality-scorecard',
  generatedBy:'scripts/build-encyclopedia-quality-scorecard.mjs',
  scoringBoundary:'Quality score ranks automated repair work. It never grants scientific approval, independent review, or publication authorization.',
  summary:{
    lessonCount:rows.length,
    averageScore:Math.round(rows.reduce((n,x)=>n+x.score,0)/Math.max(1,rows.length)),
    gradeA:rows.filter(x=>x.grade==='A').length,
    gradeB:rows.filter(x=>x.grade==='B').length,
    gradeC:rows.filter(x=>x.grade==='C').length,
    gradeD:rows.filter(x=>x.grade==='D').length,
    gradeF:rows.filter(x=>x.grade==='F').length,
    missingDimensionCounts:missingCounts
  },
  byPart,
  repairQueue:ranked.map((row,index)=>({rank:index+1,lessonId:row.id,title:row.title,part:row.part,score:row.score,repairPriorityScore:row.repairPriorityScore,evidenceRiskScore:row.evidenceRiskScore,blockers:row.blockers,nextActions:row.nextActions})),
  lessons:rows
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia quality scorecard');
console.log(JSON.stringify(output.summary,null,2));
console.log('Top repair targets: '+output.repairQueue.slice(0,20).map(x=>x.lessonId+'('+x.score+')').join(', '));
