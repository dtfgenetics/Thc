#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const pre=read('data/encyclopedia-visual-machine-preflight.json');
const claims=read('data/encyclopedia-claim-evidence-candidates.json');
const sources=read('data/encyclopedia-source-resolution-queue.json');
const priority=fs.existsSync(path.join(root,'data','encyclopedia-evidence-priority.json'))?read('data/encyclopedia-evidence-priority.json'):{lessons:[]};
const claimById=new Map((claims.lessons||[]).map(x=>[x.lessonId,x]));
const sourceById=new Map((sources.lessons||[]).map(x=>[x.lessonId,x]));
const priorityById=new Map((priority.lessons||[]).map(x=>[x.id||x.lessonId,x]));

const rows=(pre.candidates||[])
  .filter(x=>x.evidenceMappingRequired)
  .map(x=>{
    const c=claimById.get(x.lessonId)||{};
    const s=sourceById.get(x.lessonId)||{};
    const p=priorityById.get(x.lessonId)||{};
    return {
      lessonId:x.lessonId,
      title:x.title,
      visualFamily:x.visualFamily,
      candidateClaimCount:Number(c.claimCount||0),
      claims:(c.claims||[]).map(claim=>({
        candidateId:claim.candidateId,
        claimKind:claim.claimKind,
        candidateClaim:claim.candidateClaim,
        sourceReferenceIds:claim.sourceReferenceIds,
        mappingState:claim.mappingState,
        reviewState:claim.reviewState
      })),
      sourceResolutionState:s.resolutionState||'source_resolution_incomplete',
      sourceReferenceIds:s.sourceReferenceIds||[],
      evidenceReferenceCount:Number(s.evidenceReferenceCount||0),
      traceableReferenceCount:Number(s.traceableReferenceCount||0),
      unresolvedEvidenceReferenceCount:Number(s.unresolvedEvidenceReferenceCount||0),
      evidencePriorityScore:Number(p.priorityScore||0),
      evidenceRiskScore:Number(p.riskScore||0),
      nextAction:(s.resolutionState==='source_resolution_incomplete'||Number(s.unresolvedEvidenceReferenceCount||0)>0)
        ? 'resolve_source_identity_then_review_claim_mapping'
        : 'review_candidate_claim_source_mapping'
    };
  })
  .sort((a,b)=>
    b.evidencePriorityScore-a.evidencePriorityScore||
    b.evidenceRiskScore-a.evidenceRiskScore||
    b.unresolvedEvidenceReferenceCount-a.unresolvedEvidenceReferenceCount||
    a.lessonId.localeCompare(b.lessonId)
  );

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-evidence-mapping-work-queue',
  generatedBy:'scripts/build-encyclopedia-evidence-mapping-work-queue.mjs',
  boundary:'This queue prepares claim/source review work only. Candidate mappings remain unverified and must not be treated as scientific approval or publication authorization.',
  summary:{
    lessonsNeedingClaimEvidence:rows.length,
    withTraceableSourceSet:rows.filter(x=>x.sourceResolutionState!=='source_resolution_incomplete').length,
    needingSourceResolution:rows.filter(x=>x.sourceResolutionState==='source_resolution_incomplete').length,
    candidateClaims:rows.reduce((n,x)=>n+x.candidateClaimCount,0),
    independentlyReviewedClaims:0,
    publicationApprovedClaims:0
  },
  workQueue:rows.map((row,index)=>({rank:index+1,...row}))
};
fs.writeFileSync(path.join(root,'data','encyclopedia-evidence-mapping-work-queue.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary,null,2));
