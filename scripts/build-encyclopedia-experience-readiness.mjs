#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const exists=p=>fs.existsSync(path.join(root,p));
const outPath=path.join(root,'data','encyclopedia-experience-readiness.json');

const discovery=read('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json');
const visuals=read('content/encyclopedia/visual-production-queue-v1.json');
const lifecycle=exists('data/encyclopedia-lifecycle-audit.json')?read('data/encyclopedia-lifecycle-audit.json'):null;
const quality=exists('data/encyclopedia-quality-scorecard.json')?read('data/encyclopedia-quality-scorecard.json'):null;

const byVisualId=new Map((visuals.items||[]).map(x=>[x.lessonId,x]));
const lifecycleById=new Map((lifecycle?.lessons||[]).map(x=>[x.id,x]));
const lifecycleIssues=new Map((lifecycle?.repairQueue||[]).map(x=>[x.id,x]));
const qualityById=new Map((quality?.lessons||[]).map(x=>[x.id,x]));

const rows=(discovery.lessons||[]).map(item=>{
  const v=byVisualId.get(item.id)||{};
  const l=lifecycleById.get(item.id)||{};
  const li=lifecycleIssues.get(item.id)||{};
  const q=qualityById.get(item.id)||{};
  const published=item.status==='published';
  const evidenceCount=Number(item.evidence?.claimCount||0);
  const visualState=item.visual?.state||(
    v.productionStatus==='raster_artwork_produced_review_pending'?'candidate':
    v.productionStatus==='brief_ready_raster_artwork_needed'?'needed':'unknown'
  );
  const independentApproval=l.independentApproval===true;
  const visitorBaselineReady=published&&Boolean(item.route)&&Boolean(item.title)&&Boolean(item.objective);
  const instructionalCompletionReady=visitorBaselineReady&&visualState==='curated'&&evidenceCount>0&&independentApproval&&Number(li.issues||0)===0;
  const blockers=[
    ...(!published?['not_published']:[]),
    ...(visualState!=='curated'?['teaching_visual_'+visualState]:[]),
    ...(evidenceCount<1?['claim_evidence_missing']:[]),
    ...(!independentApproval?['independent_science_review_pending']:[]),
    ...(Number(li.issues||0)>0?['lifecycle_cleanup']:[])
  ];
  const visualPriority=Number(v.visualPriorityScore||0);
  const qualityScore=Number(q.score||0);
  const repairPriority=(blockers.length*20)+(visualState==='needed'?20:visualState==='candidate'?8:0)+(evidenceCount<1?12:0)+(independentApproval?0:12)+visualPriority+(qualityScore?Math.max(0,100-qualityScore):0);
  return {
    id:item.id,
    number:item.number,
    title:item.title,
    part:item.part,
    route:item.route,
    published,
    visualState,
    visualFamily:v.visualFamily||null,
    visualPriorityScore:visualPriority,
    evidenceClaimCount:evidenceCount,
    independentApproval,
    lifecycleIssueCount:Number(li.issues||0),
    qualityScore:qualityScore||null,
    visitorBaselineReady,
    instructionalCompletionReady,
    blockers,
    repairPriority
  };
});

const count=fn=>rows.filter(fn).length;
const published=count(x=>x.published);
const summary={
  lessonCount:rows.length,
  publishedCount:published,
  visitorBaselineReady:count(x=>x.visitorBaselineReady),
  instructionalCompletionReady:count(x=>x.instructionalCompletionReady),
  curatedVisuals:count(x=>x.visualState==='curated'),
  visualCandidatesPendingReview:count(x=>x.visualState==='candidate'),
  visualsNeeded:count(x=>x.visualState==='needed'),
  lessonsWithEvidence:count(x=>x.evidenceClaimCount>0),
  independentlyApprovedLessons:count(x=>x.independentApproval),
  lifecycleCleanLessons:count(x=>x.lifecycleIssueCount===0),
  publicationPercent:rows.length?Math.round(100*published/rows.length):0,
  curatedVisualPercent:rows.length?Math.round(100*count(x=>x.visualState==='curated')/rows.length):0,
  evidenceMappedPercent:rows.length?Math.round(100*count(x=>x.evidenceClaimCount>0)/rows.length):0,
  independentApprovalPercent:rows.length?Math.round(100*count(x=>x.independentApproval)/rows.length):0
};
const priorityQueue=[...rows].filter(x=>!x.instructionalCompletionReady).sort((a,b)=>b.repairPriority-a.repairPriority||a.number-b.number).map((x,index)=>({
  rank:index+1,
  lessonId:x.id,
  title:x.title,
  part:x.part,
  repairPriority:x.repairPriority,
  blockers:x.blockers,
  visualFamily:x.visualFamily,
  visualPriorityScore:x.visualPriorityScore,
  qualityScore:x.qualityScore
}));

const output={
  schemaVersion:1,
  artifactId:'thc-encyclopedia-experience-readiness',
  generatedBy:'scripts/build-encyclopedia-experience-readiness.mjs',
  definition:'Visitor baseline readiness means the published lesson is routable and has core public copy. Instructional completion readiness additionally requires a curated visual, mapped evidence, independent scientific approval, and no lifecycle cleanup findings.',
  safetyBoundary:'This report is an operational completion dashboard. It does not grant scientific, legal, accessibility, or publication approval.',
  summary,
  priorityQueue,
  lessons:rows
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia experience readiness');
console.log(JSON.stringify(summary,null,2));
console.log('Top completion targets: '+priorityQueue.slice(0,20).map(x=>x.lessonId).join(', '));
