#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const arr=v=>Array.isArray(v)?v:[];
const priority=read('data/encyclopedia-evidence-priority.json');
const candidates=read('data/encyclopedia-claim-evidence-candidates.json');
const outPath=path.join(root,'data','encyclopedia-unmapped-evidence-review-packets.json');

const priorityById=new Map(arr(priority.lessons).map(row=>[row.id,row]));
const candidateById=new Map(arr(candidates.lessons).map(row=>[row.lessonId,row]));

function sourceOptionKey(source){
  const identities=arr(source.sourceIdentityKeys).filter(Boolean).sort();
  if(identities.length) return identities[0];
  const authority=arr(source.resolvedAuthoritativeSourceIds).filter(Boolean).sort();
  if(authority.length) return 'authority:'+authority[0];
  if(source.volumeRegistryRecord?.id) return 'volume:'+source.volumeRegistryRecord.id;
  return 'reference:'+source.referenceId;
}

function rankSource(source){
  let score=0;
  if(arr(source.resolvedAuthoritativeSourceIds).length) score+=8;
  if(arr(source.directLocators).length) score+=5;
  if(source.volumeRegistryRecord?.location?.startsWith?.('https://')) score+=4;
  if(source.traceable===true) score+=2;
  if(arr(source.duplicateGroupIds).length) score-=1;
  return score;
}

const packets=[];
for(const row of arr(priority.lessons)){
  if(Number(row.claimEvidenceCount||0)>0) continue;
  const candidate=candidateById.get(row.id);
  if(!candidate) throw new Error(row.id+': missing claim-evidence candidate row');

  const sourceMap=new Map();
  for(const claim of arr(candidate.claims)){
    for(const source of arr(claim.candidateSourceTraceability)){
      const key=sourceOptionKey(source);
      const existing=sourceMap.get(key);
      const option={
        sourceOptionKey:key,
        referenceId:source.referenceId,
        rawReference:source.rawReference,
        resolutionStatus:source.resolutionStatus,
        traceable:source.traceable===true,
        resolvedAuthoritativeSourceIds:arr(source.resolvedAuthoritativeSourceIds),
        directLocators:arr(source.directLocators),
        sourceIdentityKeys:arr(source.sourceIdentityKeys),
        duplicateGroupIds:arr(source.duplicateGroupIds),
        volumeRegistryRecord:source.volumeRegistryRecord||null,
        sourcePriorityScore:rankSource(source)
      };
      if(!existing || option.sourcePriorityScore>existing.sourcePriorityScore) sourceMap.set(key,option);
    }
  }
  const sourceOptions=[...sourceMap.values()].sort((a,b)=>b.sourcePriorityScore-a.sourcePriorityScore||a.sourceOptionKey.localeCompare(b.sourceOptionKey));
  const sourceKeys=new Set(sourceOptions.map(s=>s.sourceOptionKey));
  const claims=arr(candidate.claims).map(claim=>({
    candidateId:claim.candidateId,
    claimKind:claim.claimKind,
    candidateClaim:claim.candidateClaim,
    candidateSourceOptionKeys:[...new Set(arr(claim.candidateSourceTraceability).map(sourceOptionKey))].filter(key=>sourceKeys.has(key)),
    mappingDecision:null,
    selectedSourceOptionKeys:[],
    reviewerNotes:null,
    reviewState:'pending_independent_science_review'
  }));

  packets.push({
    rank:0,
    lessonId:row.id,
    number:row.number,
    part:row.part,
    title:row.title,
    evidencePriorityScore:Number(row.priorityScore||0),
    evidenceRiskScore:Number(row.riskScore||0),
    riskFlags:row.riskFlags||{},
    sourceNotesCount:Number(row.sourceNotes||0),
    claimCount:claims.length,
    sourceOptionCount:sourceOptions.length,
    reviewReady:claims.length>0&&sourceOptions.length>0&&claims.every(claim=>claim.candidateSourceOptionKeys.length>0),
    requiredOutcome:'independent claim-to-source binding, documented limitation, or documented no-source decision',
    claims,
    sourceOptions,
    lessonReviewDecision:null,
    reviewerId:null,
    reviewedAt:null,
    publicationEffect:'none'
  });
}

packets.sort((a,b)=>b.evidencePriorityScore-a.evidencePriorityScore||b.evidenceRiskScore-a.evidenceRiskScore||a.number-b.number);
packets.forEach((row,index)=>row.rank=index+1);

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-unmapped-evidence-review-packets',
  generatedBy:'scripts/build-encyclopedia-unmapped-evidence-review-packets.mjs',
  scope:'Reviewer-ready packets for controlled encyclopedia lessons with no materialized claim-evidence record.',
  reviewBoundary:'Source options are traceable candidates only. This artifact never asserts that a source supports a claim and never creates review or publication approval.',
  summary:{
    unmappedLessons:packets.length,
    highPriorityUnmapped:packets.filter(row=>row.evidencePriorityScore>=8).length,
    reviewReady:packets.filter(row=>row.reviewReady).length,
    notReviewReady:packets.filter(row=>!row.reviewReady).length,
    candidateClaims:packets.reduce((n,row)=>n+row.claimCount,0),
    uniqueSourceOptions:packets.reduce((set,row)=>{for(const s of row.sourceOptions)set.add(s.sourceOptionKey);return set;},new Set()).size,
    generatedReviewerDecisions:0
  },
  packets
};

fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Unmapped encyclopedia evidence review packets');
console.log(JSON.stringify(output.summary,null,2));
console.log('Top packets: '+packets.slice(0,20).map(row=>row.lessonId+'('+row.evidencePriorityScore+')').join(', '));
