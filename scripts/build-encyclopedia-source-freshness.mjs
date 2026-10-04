#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const registry=read('content/encyclopedia/evidence/authoritative-sources.json');
const sourceQueue=fs.existsSync(path.join(root,'data','encyclopedia-source-resolution-queue.json'))
  ? read('data/encyclopedia-source-resolution-queue.json')
  : {references:[]};
const arr=v=>Array.isArray(v)?v:[];
const outPath=path.join(root,'data','encyclopedia-source-freshness.json');
const now=new Date();

const externalVolumeSources=[];
for(let part=1;part<=21;part+=1){
  const registerPath=path.join(root,'content','encyclopedia',`volume-${String(part).padStart(2,'0')}`,'source-register.json');
  if(!fs.existsSync(registerPath)) continue;
  const register=JSON.parse(fs.readFileSync(registerPath,'utf8'));
  for(const source of arr(register.sources)){
    const location=String(source.location||'').trim();
    if(!/^https:\/\//.test(location)) continue;
    externalVolumeSources.push({
      id:source.id,
      sourceType:'volume_register_external',
      authorityClass:'controlled_external_source',
      title:source.title,
      url:location,
      useAndLimitations:source.useAndLimitation||null,
      volumePart:part
    });
  }
}
const allSources=[...arr(registry.sources),...externalVolumeSources];

function policyFor(source){
  const type=String(source.sourceType||'').toLowerCase();
  const authority=String(source.authorityClass||'').toLowerCase();
  const url=String(source.url||'').toLowerCase();
  if(/legal|regulat|official_standard|official_guidance|official_dataset|official_database|extension/.test(type+' '+authority) || /\.gov\//.test(url)){
    return {reviewIntervalDays:365,volatility:'high'};
  }
  if(/standard|measurement|method/.test(type+' '+authority) || /(?:iso\.org|astm\.org|bipm\.org|seedtest\.org)/.test(url)){
    return {reviewIntervalDays:730,volatility:'medium'};
  }
  if(/peer_reviewed|primary|review|journal/.test(type+' '+authority) || /(?:doi\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov)/.test(url)){
    return {reviewIntervalDays:1095,volatility:'medium'};
  }
  return {reviewIntervalDays:730,volatility:'medium'};
}

function peerReviewed(source){
  const type=String(source.sourceType||'').toLowerCase();
  const url=String(source.url||'').toLowerCase();
  return /peer_reviewed|primary|review|journal|doctoral_dissertation/.test(type) ||
    /(?:doi\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov)/.test(url);
}

const lessonsBySource=new Map();
for(const ref of arr(sourceQueue.references)){
  for(const sourceId of arr(ref.resolvedAuthoritativeSourceIds)){
    if(!lessonsBySource.has(sourceId)) lessonsBySource.set(sourceId,new Set());
    for(const lessonId of arr(ref.lessonIds)) lessonsBySource.get(sourceId).add(lessonId);
  }
  const volumeSourceId=ref.volumeRegistryRecord?.id;
  if(volumeSourceId){
    if(!lessonsBySource.has(volumeSourceId)) lessonsBySource.set(volumeSourceId,new Set());
    for(const lessonId of arr(ref.lessonIds)) lessonsBySource.get(volumeSourceId).add(lessonId);
  }
}

const sources=allSources.map(source=>{
  const policy=policyFor(source);
  const lastVerifiedAt=source.lastVerifiedAt||source.lastVerified||null;
  let nextReviewAt=null;
  let freshnessStatus='verification_date_missing';
  if(lastVerifiedAt){
    const last=new Date(lastVerifiedAt);
    if(Number.isNaN(last.getTime())){
      freshnessStatus='invalid_verification_date';
    }else{
      nextReviewAt=new Date(last.getTime()+policy.reviewIntervalDays*86400000).toISOString();
      const remainingDays=Math.floor((new Date(nextReviewAt)-now)/86400000);
      freshnessStatus=remainingDays<0?'overdue':remainingDays<=60?'due_soon':'current';
    }
  }
  const retractionRequired=peerReviewed(source);
  const retractionStatus=source.retractionStatus||source.retractionCheckStatus||(retractionRequired?'not_checked':'not_applicable');
  const impactedLessonIds=[...(lessonsBySource.get(source.id)||new Set())].sort();
  const needsFreshnessReview=freshnessStatus!=='current';
  const needsRetractionReview=retractionRequired&&!['checked_clear','not_retracted','clear'].includes(String(retractionStatus).toLowerCase());
  const priorityScore=
    (policy.volatility==='high'?4:2)+
    (freshnessStatus==='verification_date_missing'?6:freshnessStatus==='overdue'?5:freshnessStatus==='due_soon'?3:0)+
    (needsRetractionReview?4:0)+
    Math.min(5,impactedLessonIds.length);
  return {
    sourceId:source.id,
    title:source.title,
    sourceType:source.sourceType||null,
    authorityClass:source.authorityClass||null,
    publicationYear:source.year||null,
    url:source.url||null,
    doi:source.doi||null,
    pmcid:source.pmcid||null,
    lastVerifiedAt,
    nextReviewAt,
    reviewIntervalDays:policy.reviewIntervalDays,
    volatility:policy.volatility,
    freshnessStatus,
    retractionCheckRequired:retractionRequired,
    retractionStatus,
    impactedLessonCount:impactedLessonIds.length,
    impactedLessonIds,
    priorityScore,
    requiresRevalidation:needsFreshnessReview||needsRetractionReview,
    reviewState:'pending_explicit_source_revalidation',
    publicationEffect:'none'
  };
}).sort((a,b)=>b.priorityScore-a.priorityScore||a.sourceId.localeCompare(b.sourceId));

const summary={
  sourceCount:sources.length,
  centralRegistrySources:arr(registry.sources).length,
  externalVolumeSources:externalVolumeSources.length,
  withExplicitVerificationDate:sources.filter(x=>x.lastVerifiedAt).length,
  verificationDateMissing:sources.filter(x=>x.freshnessStatus==='verification_date_missing').length,
  overdue:sources.filter(x=>x.freshnessStatus==='overdue').length,
  dueSoon:sources.filter(x=>x.freshnessStatus==='due_soon').length,
  current:sources.filter(x=>x.freshnessStatus==='current').length,
  retractionChecksPending:sources.filter(x=>x.retractionCheckRequired&&!['checked_clear','not_retracted','clear'].includes(String(x.retractionStatus).toLowerCase())).length,
  requiresRevalidation:sources.filter(x=>x.requiresRevalidation).length
};

const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-source-freshness',
  generatedBy:'scripts/build-encyclopedia-source-freshness.mjs',
  generatedAt:now.toISOString(),
  scope:'Central authoritative registry plus HTTPS-backed controlled volume sources: freshness, volatility, explicit verification, and retraction-review queue.',
  rule:'Registry edit dates are not treated as source verification dates. Missing explicit verification or retraction checks remain pending and never change publication state automatically.',
  summary,
  revalidationQueue:sources.filter(x=>x.requiresRevalidation).map((x,index)=>({
    rank:index+1,
    sourceId:x.sourceId,
    title:x.title,
    priorityScore:x.priorityScore,
    freshnessStatus:x.freshnessStatus,
    retractionStatus:x.retractionStatus,
    impactedLessonCount:x.impactedLessonCount
  })),
  sources
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia source freshness');
console.log(JSON.stringify(summary,null,2));
console.log('Wrote data/encyclopedia-source-freshness.json');
