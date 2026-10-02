#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const evidenceRoot=path.join(root,'content','encyclopedia','evidence');
const contractPath=path.join(evidenceRoot,'dataset-claim-bridge-contract.json');
const errors=[];
const arr=v=>Array.isArray(v)?v:[];
const fail=m=>errors.push(m);
if(!fs.existsSync(contractPath)) fail('Missing dataset reviewed-claim bridge contract.');
else {
  const c=JSON.parse(fs.readFileSync(contractPath,'utf8'));
  if(c.contractId!=='thc-dataset-reviewed-claim-bridge') fail('Unexpected bridge contractId.');
  if(c.upstream?.repository!=='dtfgenetics/Thc-dataset') fail('Bridge must target dtfgenetics/Thc-dataset.');
  if(c.upstream?.identityField!=='claim_sha256') fail('Bridge identity must be claim_sha256.');
}
const seen=new Map();
for(const name of fs.readdirSync(evidenceRoot).filter(n=>/^evidence-batch-\d+\.json$/.test(n)).sort()){
  const batch=JSON.parse(fs.readFileSync(path.join(evidenceRoot,name),'utf8'));
  for(const item of arr(batch.claimEvidence)){
    const sha=item.datasetClaimSha256;
    const source=item.datasetSourceId;
    if(sha!==undefined && !/^[0-9a-f]{64}$/.test(String(sha))) fail(`${item.evidenceId}: invalid datasetClaimSha256`);
    if(source!==undefined && !String(source).trim()) fail(`${item.evidenceId}: empty datasetSourceId`);
    if((sha===undefined)!==(source===undefined)) fail(`${item.evidenceId}: datasetClaimSha256 and datasetSourceId must be supplied together`);
    if(sha){
      const prior=seen.get(sha);
      if(prior && prior!==item.evidenceId) fail(`${item.evidenceId}: dataset claim ${sha} already bound by ${prior}; use one canonical evidence binding and reference it`);
      seen.set(sha,item.evidenceId);
      if(item.datasetRepository!=='dtfgenetics/Thc-dataset') fail(`${item.evidenceId}: datasetRepository must be dtfgenetics/Thc-dataset`);
      if(item.datasetSchemaVersion!=='grow-doc-reviewed-claim-v1') fail(`${item.evidenceId}: datasetSchemaVersion must be grow-doc-reviewed-claim-v1`);
    }
  }
}
if(errors.length){console.error(`Dataset claim bridge validation failed with ${errors.length} error(s):`);for(const e of errors)console.error(' - '+e);process.exit(1);}
console.log(`Dataset claim bridge PASS: ${seen.size} upstream reviewed claim binding(s); unbound local evidence remains valid but review-pending.`);
