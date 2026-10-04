#!/usr/bin/env node
import fs from 'node:fs';

const file='data/encyclopedia-claim-evidence-candidates.json';
const sourceFile='data/encyclopedia-source-resolution-queue.json';
const errors=[];
const arr=v=>Array.isArray(v)?v:[];

if(!fs.existsSync(file)) errors.push('missing claim-evidence candidate ledger');
if(!fs.existsSync(sourceFile)) errors.push('missing source-resolution queue');

if(!errors.length){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const sourceQueue=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  const refs=new Set(arr(sourceQueue.references).map(row=>row.referenceId));
  const refById=new Map(arr(sourceQueue.references).map(row=>[row.referenceId,row]));
  const seenLessons=new Set();
  const seenCandidates=new Set();

  if(data.schemaVersion!=='1.0.0') errors.push('schemaVersion must be 1.0.0');
  if(data.artifactId!=='thc-encyclopedia-claim-evidence-candidates') errors.push('artifactId mismatch');
  if(arr(data.lessons).length!==420) errors.push(`expected 420 lessons; found ${arr(data.lessons).length}`);

  for(let index=0;index<arr(data.lessons).length;index+=1){
    const row=data.lessons[index];
    const expected=`THC-ENC-${String(index+1).padStart(3,'0')}`;
    if(row.lessonId!==expected) errors.push(`row ${index+1}: expected ${expected}, found ${row.lessonId||'(missing)'}`);
    if(seenLessons.has(row.lessonId)) errors.push(`duplicate lesson ${row.lessonId}`);
    seenLessons.add(row.lessonId);
    if(!row.canonicalFile?.includes('/lessons/thc-enc-')) errors.push(`${row.lessonId}: canonicalFile must be an individual lesson path`);
    if(!arr(row.claims).length) errors.push(`${row.lessonId}: candidate claims missing`);
    const controlRefs=arr(row.controlContextReferenceIds);
    for(const refId of controlRefs){
      const ref=refById.get(refId);
      if(!ref) errors.push(`${row.lessonId}: unknown control/context reference ${refId}`);
      else if(ref.traceabilityRequired!==false) errors.push(`${row.lessonId}: control/context reference ${refId} is marked as evidence-required`);
    }

    for(const claim of arr(row.claims)){
      if(!/^ENC-CLAIM-CAND-\d{5}$/.test(claim.candidateId||'')) errors.push(`${row.lessonId}: invalid candidateId ${claim.candidateId||'(missing)'}`);
      if(seenCandidates.has(claim.candidateId)) errors.push(`duplicate candidateId ${claim.candidateId}`);
      seenCandidates.add(claim.candidateId);
      if(claim.lessonId!==row.lessonId) errors.push(`${claim.candidateId}: lessonId mismatch`);
      if(!['objective','core-science'].includes(claim.claimKind)) errors.push(`${claim.candidateId}: unsupported claimKind`);
      if(String(claim.candidateClaim||'').length<24) errors.push(`${claim.candidateId}: candidateClaim missing/thin`);
      if(claim.mappingState!=='candidate_unverified_requires_claim_source_review') errors.push(`${claim.candidateId}: mappingState must remain candidate/unverified`);
      if(claim.reviewState!=='pending_independent_science_review') errors.push(`${claim.candidateId}: reviewState must remain pending independent review`);
      if(claim.publicationEffect!=='none') errors.push(`${claim.candidateId}: publicationEffect must be none`);
      if('supportedClaim' in claim) errors.push(`${claim.candidateId}: candidate ledger must not assert supportedClaim`);
      for(const refId of arr(claim.sourceReferenceIds)) {
        if(!refs.has(refId)) errors.push(`${claim.candidateId}: unknown source reference ${refId}`);
        const ref=refById.get(refId);
        if(ref?.traceabilityRequired===false) errors.push(`${claim.candidateId}: control/context note ${refId} cannot be attached as candidate claim evidence`);
      }
      for(const source of arr(claim.candidateSourceTraceability)){
        if(!refs.has(source.referenceId)) errors.push(`${claim.candidateId}: traceability row references unknown source ${source.referenceId}`);
        if(new Set(arr(source.sourceIdentityKeys)).size!==arr(source.sourceIdentityKeys).length) errors.push(`${claim.candidateId}: duplicate sourceIdentityKeys for ${source.referenceId}`);
        for(const key of arr(source.sourceIdentityKeys)) if(!/^(doi|pmc|pmid|url):/.test(String(key))) errors.push(`${claim.candidateId}: invalid source identity key ${key}`);
        for(const locator of arr(source.directLocators)) if(!/^https:\/\//.test(String(locator))) errors.push(`${claim.candidateId}: direct locator must use HTTPS`);
      }
    }
  }

  if(Number(data.summary?.independentlyReviewedClaims||0)!==0) errors.push('candidate ledger must not claim independently reviewed claims');
  if(Number(data.summary?.publicationApprovedClaims||0)!==0) errors.push('candidate ledger must not claim publication-approved claims');
}

if(errors.length){
  console.error(`Encyclopedia claim-evidence candidate validation failed with ${errors.length} issue(s):`);
  for(const error of errors.slice(0,200)) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia claim-evidence candidate ledger PASS: 420 lessons; candidate mappings remain explicitly unreviewed and non-publishing.');
