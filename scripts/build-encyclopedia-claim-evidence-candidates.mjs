#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const outPath=path.join(root,'data','encyclopedia-claim-evidence-candidates.json');
const sourceQueuePath=path.join(root,'data','encyclopedia-source-resolution-queue.json');
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

if(!fs.existsSync(sourceQueuePath)){
  console.error('Missing data/encyclopedia-source-resolution-queue.json; build the source queue first.');
  process.exit(1);
}

const lessons=readCanonicalEncyclopediaLessons(root);
const sourceQueue=JSON.parse(fs.readFileSync(sourceQueuePath,'utf8'));
const referenceById=new Map(arr(sourceQueue.references).map(row=>[row.referenceId,row]));
const queueLessonById=new Map(arr(sourceQueue.lessons).map(row=>[row.lessonId,row]));

const rows=[];
let claimNumber=0;
for(const lesson of lessons){
  const sourceRow=queueLessonById.get(lesson.id)||{};
  const allSourceReferenceIds=arr(sourceRow.sourceReferenceIds).filter(Boolean);
  const evidenceSourceReferenceIds=allSourceReferenceIds.filter(id=>referenceById.get(id)?.traceabilityRequired!==false);
  const controlContextReferenceIds=allSourceReferenceIds.filter(id=>referenceById.get(id)?.traceabilityRequired===false);
  const claimInputs=[
    {kind:'objective',text:lesson.objective},
    ...arr(lesson.coreScience).map(text=>({kind:'core-science',text}))
  ].filter(item=>clean(item.text));

  const claims=claimInputs.map((item,index)=>{
    claimNumber+=1;
    const sources=evidenceSourceReferenceIds.map(id=>referenceById.get(id)).filter(Boolean);
    return {
      candidateId:`ENC-CLAIM-CAND-${String(claimNumber).padStart(5,'0')}`,
      lessonId:lesson.id,
      lessonNumber:Number(lesson.number),
      part:lesson.__part,
      claimIndex:index+1,
      claimKind:item.kind,
      candidateClaim:clean(item.text),
      sourceReferenceIds:evidenceSourceReferenceIds,
      candidateSourceTraceability:sources.map(source=>({
        referenceId:source.referenceId,
        rawReference:source.rawReference,
        resolutionStatus:source.resolutionStatus,
        referenceKind:source.referenceKind||null,
        traceabilityRequired:source.traceabilityRequired!==false,
        traceable:source.traceable===true,
        resolvedAuthoritativeSourceIds:arr(source.resolvedAuthoritativeSourceIds),
        directLocators:arr(source.directLocators),
        sourceIdentityKeys:arr(source.sourceIdentityKeys),
        duplicateGroupIds:arr(source.duplicateGroupIds),
        volumeRegistryRecord:source.volumeRegistryRecord||null
      })),
      mappingState:'candidate_unverified_requires_claim_source_review',
      reviewState:'pending_independent_science_review',
      publicationEffect:'none'
    };
  });

  rows.push({
    lessonId:lesson.id,
    number:Number(lesson.number),
    part:lesson.__part,
    title:lesson.title,
    canonicalFile:lesson.__path,
    sourceTraceabilityState:sourceRow.resolutionState||'source_resolution_incomplete',
    claimCount:claims.length,
    sourceReferenceCount:evidenceSourceReferenceIds.length,
    controlContextNoteCount:controlContextReferenceIds.length,
    controlContextReferenceIds,
    claims
  });
}

const allClaims=rows.flatMap(row=>row.claims);
const summary={
  lessonCount:rows.length,
  candidateClaimCount:allClaims.length,
  objectiveClaims:allClaims.filter(c=>c.claimKind==='objective').length,
  coreScienceClaims:allClaims.filter(c=>c.claimKind==='core-science').length,
  lessonsWithCandidateClaims:rows.filter(row=>row.claimCount>0).length,
  lessonsWithTraceableSources:rows.filter(row=>row.sourceTraceabilityState!=='source_resolution_incomplete').length,
  independentlyReviewedClaims:0,
  publicationApprovedClaims:0,
  candidateSourceReferencesInDuplicateGroups:allClaims.reduce((n,claim)=>n+claim.candidateSourceTraceability.filter(source=>source.duplicateGroupIds.length>0).length,0)
};

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-claim-evidence-candidates',
  generatedBy:'scripts/build-encyclopedia-claim-evidence-candidates.mjs',
  scope:'Candidate objective and core-science claim/source review ledger for all 420 controlled THC-ENC lessons.',
  releaseRule:'Candidate mappings are reviewer work aids only. They do not assert that a listed source supports a claim and never change lesson review or publication state.',
  summary,
  lessons:rows
};

fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia claim candidates: ${summary.lessonCount}/420 lessons · ${summary.candidateClaimCount} objective/core-science claims · ${summary.lessonsWithTraceableSources} lessons with fully traceable source sets`);
console.log('Wrote data/encyclopedia-claim-evidence-candidates.json');

if(rows.length!==420){
  console.error(`Expected 420 candidate-ledger lesson rows; found ${rows.length}.`);
  process.exit(1);
}
