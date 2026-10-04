#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const evidenceDir=path.join(root,'content','encyclopedia','evidence');
const sourceQueue=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-source-resolution-queue.json'),'utf8'));
const candidates=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-claim-evidence-candidates.json'),'utf8'));
const tracking=JSON.parse(fs.readFileSync(path.join(root,'data','encyclopedia-evidence-tracking.json'),'utf8'));
const existingByLesson=new Map((tracking.lessons||[]).map(x=>[x.id,Number(x.evidence?.claimEvidenceCount||0)]));
const refById=new Map((sourceQueue.references||[]).map(x=>[x.referenceId,x]));

const existingFiles=fs.readdirSync(evidenceDir).filter(x=>/^evidence-batch-\d+\.json$/.test(x)).sort();
let maxEvidence=0, maxBatch=0;
for(const file of existingFiles){
  const batch=JSON.parse(fs.readFileSync(path.join(evidenceDir,file),'utf8'));
  const bm=String(batch.batchId||'').match(/(\d+)$/); if(bm) maxBatch=Math.max(maxBatch,Number(bm[1]));
  for(const row of batch.claimEvidence||[]){ const m=String(row.evidenceId||'').match(/(\d+)$/); if(m) maxEvidence=Math.max(maxEvidence,Number(m[1])); }
}

const out=[];
const skipped=[];
for(const lesson of candidates.lessons||[]){
  if((existingByLesson.get(lesson.lessonId)||0)>0) continue;
  const claim=(lesson.claims||[])[0];
  if(!claim){ skipped.push({lessonId:lesson.lessonId,reason:'no_candidate_claim'}); continue; }
  const sourceIds=new Set();
  const sourceReferenceIds=new Set();
  const locators=[];
  for(const refId of claim.sourceReferenceIds||[]){
    const ref=refById.get(refId); if(!ref) continue;
    if(ref.traceabilityRequired!==false && ref.traceable===true) sourceReferenceIds.add(refId);
    for(const id of ref.resolvedAuthoritativeSourceIds||[]) sourceIds.add(id);
    const volume=ref.volumeRegistryRecord;
    if(volume?.id && /^https:\/\//.test(String(volume.location||''))) sourceIds.add(volume.id);
    for(const url of ref.directLocators||[]) locators.push(url);
  }
  if(!sourceIds.size && !sourceReferenceIds.size){
    skipped.push({lessonId:lesson.lessonId,reason:'no_traceable_source_reference',sourceReferenceIds:claim.sourceReferenceIds||[]});
    continue;
  }
  maxEvidence+=1;
  out.push({
    evidenceId:`ENC-EVID-${String(maxEvidence).padStart(4,'0')}`,
    lessonId:lesson.lessonId,
    sourceIds:[...sourceIds].sort(),
    sourceReferenceIds:[...sourceReferenceIds].sort(),
    claimType:`candidate-${String(claim.claimKind||'claim').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`,
    supportedClaim:`Candidate review mapping: ${String(claim.candidateClaim||'').trim()}`,
    sourceLocator:locators.length
      ? [...new Set(locators)].join('; ')
      : sourceIds.size
        ? `Resolved source registry IDs: ${[...sourceIds].sort().join(', ')}`
        : `Controlled traceable source references: ${[...sourceReferenceIds].sort().join(', ')}`,
    applicability:'Candidate claim-to-source mapping prepared from the controlled source-resolution queue. Independent science review must confirm whether the cited source actually supports the scoped claim.',
    limitations:'This generated mapping is not scientific approval, does not assert that the source fully supports the claim, and does not authorize publication. Scope, methods, population/genotype, treatment conditions, and transferability must be checked by an independent reviewer.',
    reviewState:'source_collected_needs_science_review'
  });
}

const batchNo=maxBatch+1;
const batch={
  schemaVersion:'1.0.0',
  batchId:`ENC-EVID-BATCH-${String(batchNo).padStart(3,'0')}`,
  createdAt:new Date().toISOString().slice(0,10),
  scope:'Conservative candidate claim-evidence mappings for lessons that previously had no claim-level evidence record but had at least one recognized traceable source ID.',
  sourceRegistry:'content/encyclopedia/evidence/authoritative-sources.json',
  status:'source_collection_initial',
  reviewState:'needs_independent_science_review',
  publicationEffect:'none_review_state_unchanged',
  rules:[
    'Generated mappings are candidates for independent science review, not approval.',
    'A source ID is included only when it is already recognized by the controlled source-resolution system.',
    'The first objective/core-science claim is used as a review target; reviewers must confirm support, scope, applicability, and limitations.',
    'No lesson publication or visual approval state is changed by this batch.'
  ],
  claimEvidence:out
};

const outputPath=path.join(evidenceDir,`evidence-batch-${String(batchNo).padStart(3,'0')}.json`);
fs.writeFileSync(outputPath,JSON.stringify(batch,null,2)+'\n');
const report={
  generatedBatch:batch.batchId,
  mappedLessons:out.length,
  skippedLessons:skipped.length,
  skipped
};
fs.writeFileSync(path.join(root,'data','encyclopedia-candidate-evidence-batch-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!out.length) throw new Error('No safe candidate evidence records could be generated.');
