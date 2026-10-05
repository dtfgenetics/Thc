#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(),src=path.join(root,'data','encyclopedia-claim-evidence-candidates.json'),outDir=path.join(root,'review','encyclopedia-claim-evidence');
if(!fs.existsSync(src)) throw new Error('Missing claim-evidence candidate ledger.');
const data=JSON.parse(fs.readFileSync(src,'utf8')); fs.mkdirSync(outDir,{recursive:true});
const preserved=new Map();
for(const file of fs.readdirSync(outDir).filter(x=>/^batch-\d{3}\.json$/i.test(x))){
  const packet=JSON.parse(fs.readFileSync(path.join(outDir,file),'utf8'));
  for(const item of packet.items||[]){const r=item.reviewInput||{};if(Object.values(r).some(v=>v!==null&&v!=='')) preserved.set(item.candidateId,r);}
}
for(const file of fs.readdirSync(outDir)) if(/^batch-\d{3}\.json$/i.test(file)) fs.unlinkSync(path.join(outDir,file));
const claims=(data.lessons||[]).flatMap(row=>(row.claims||[]).map(claim=>({...claim,lessonTitle:row.title,canonicalFile:row.canonicalFile})));
const index=[];
for(let start=0;start<claims.length;start+=100){
  const slice=claims.slice(start,start+100),n=String(Math.floor(start/100)+1).padStart(3,'0');
  const items=slice.map(claim=>({
    candidateId:claim.candidateId,lessonId:claim.lessonId,lessonTitle:claim.lessonTitle,canonicalFile:claim.canonicalFile,claimKind:claim.claimKind,candidateClaim:claim.candidateClaim,
    candidateSourceTraceability:claim.candidateSourceTraceability,sourceReferenceIds:claim.sourceReferenceIds,
    reviewInput:preserved.get(claim.candidateId)||{decision:null,reviewerId:null,reviewerName:null,reviewedAt:null,reviewNotes:null,sourceIdentityVerified:null,sourceSupportsClaim:null,scopeApplicabilityAccurate:null,evidenceLimitAccurate:null,noOverclaim:null}
  }));
  const packet={schemaVersion:'1.0.0',batchId:`ENC-CLAIM-REVIEW-${n}`,packetType:'claim-evidence-independent-review-input',boundary:'Candidate mappings are not evidence approval. Reviewer fields must be completed by a real independent reviewer; blank fields are intentional and non-promoting.',decisionValues:['approved','changes_requested','rejected'],booleanReviewFields:['sourceIdentityVerified','sourceSupportsClaim','scopeApplicabilityAccurate','evidenceLimitAccurate','noOverclaim'],items};
  fs.writeFileSync(path.join(outDir,`batch-${n}.json`),JSON.stringify(packet,null,2)+'\n');
  index.push({batchId:packet.batchId,json:`review/encyclopedia-claim-evidence/batch-${n}.json`,itemCount:items.length});
}
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify({schemaVersion:'1.0.0',batchCount:index.length,claimCount:claims.length,batches:index},null,2)+'\n');
console.log(`Built ${index.length} claim/source review packets covering ${claims.length} candidate claims; preserved reviewer input for ${preserved.size} claim(s).`);
