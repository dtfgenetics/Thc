#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.cwd(), evRoot=path.join(root,'content','encyclopedia','evidence');
const upstreamPath=process.env.THC_DATASET_RAG_CLAIMS||path.join(root,'data','external','thc-dataset','rag_claims_v1.json');
const out=path.join(root,'data','encyclopedia-dataset-evidence-resolution.json');
const arr=v=>Array.isArray(v)?v:[], norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const batches=fs.readdirSync(evRoot).filter(n=>/^evidence-batch-\d+\.json$/.test(n)).sort().map(n=>JSON.parse(fs.readFileSync(path.join(evRoot,n),'utf8')));
const local=batches.flatMap(b=>arr(b.claimEvidence).map(e=>({...e,batchId:b.batchId})));
let upstream={schema_version:null,claims:[]}, availability='missing';
if(fs.existsSync(upstreamPath)){upstream=JSON.parse(fs.readFileSync(upstreamPath,'utf8'));availability='loaded';}
const bySha=new Map(arr(upstream.claims).map(c=>[c.claim_sha256,c]));
const byText=new Map();for(const c of arr(upstream.claims)){const k=norm(c.claim);if(!byText.has(k))byText.set(k,[]);byText.get(k).push(c);}
const rows=local.map(e=>{const sha=e.datasetClaimSha256||null, exact=sha?bySha.get(sha):null, text=byText.get(norm(e.supportedClaim))||[];
 let status='needs_research_or_review',candidateShas=[];
 if(sha&&!exact)status='broken_dataset_binding';
 else if(exact){
   if(e.datasetSourceId!==exact.source_id)status='binding_source_mismatch';
   else status='verified_dataset_binding';
 } else if(text.length===1){status='exact_text_candidate_needs_scope_review';candidateShas=[text[0].claim_sha256];}
 else if(text.length>1){status='ambiguous_exact_text_candidates';candidateShas=text.map(x=>x.claim_sha256);}
 return {evidenceId:e.evidenceId,lessonId:e.lessonId,batchId:e.batchId,status,datasetClaimSha256:sha,candidateShas};
});
const summary=rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
const doc={schemaVersion:'1.0.0',artifactId:'encyclopedia-dataset-evidence-resolution',generatedBy:'scripts/resolve-encyclopedia-dataset-evidence.mjs',upstream:{path:path.relative(root,upstreamPath).replaceAll(path.sep,'/'),availability,schemaVersion:upstream.schema_version||null,claimCount:arr(upstream.claims).length,sha256:fs.existsSync(upstreamPath)?crypto.createHash('sha256').update(fs.readFileSync(upstreamPath)).digest('hex'):null},policy:{automaticBinding:'claim_sha256 identity only',textMatch:'candidate only; requires scope review',missingUpstream:'report only; never upgrades evidence state'},summary,rows};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(doc,null,2)+'\n');
console.log('Encyclopedia dataset evidence resolution:',JSON.stringify(summary));
if(rows.some(r=>['broken_dataset_binding','binding_source_mismatch'].includes(r.status)))process.exit(1);
