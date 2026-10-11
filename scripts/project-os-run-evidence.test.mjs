import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectRunEvidence} from './project-os-run-evidence.mjs';
const repo='dtfgenetics/Thc',sha='a'.repeat(40);
const run={id:8,run_attempt:2,head_sha:sha,repository:{full_name:repo},status:'completed',conclusion:'success'};
function mock({runData=run,jobs={total_count:1,jobs:[{id:40,name:'build',status:'completed',conclusion:'success'}]},artifacts={total_count:1,artifacts:[{id:50,name:'build-output',expired:false,digest:'sha256:'+'b'.repeat(64)}]}}={}){
 return async url=>({ok:true,json:async()=>url.endsWith('/jobs?per_page=100')?jobs:url.endsWith('/artifacts?per_page=100')?artifacts:runData});
}
const args={repository:repo,sha,runId:8,attempt:2,token:'secret'};
test('returns real job and artifact metadata without inventing app attestation',async()=>{
 const result=await inspectRunEvidence({...args,fetchImpl:mock()});
 assert.equal(result.applicationAttribution,'unverified');
 assert.equal(result.jobs[0].appIds,undefined);
 assert.equal(result.artifacts[0].jobId,undefined);
 assert.equal(result.jobs[0].runAttempt,2);
 assert.equal(result.artifacts[0].runAttempt,null);
 assert.equal(result.artifacts[0].attemptAttribution,'unverified');
});
test('rejects stale identity and unsuccessful runs',async()=>{
 for(const patch of [{head_sha:'c'.repeat(40)},{run_attempt:1},{conclusion:'failure'},{status:'queued'}]){
 await assert.rejects(()=>inspectRunEvidence({...args,fetchImpl:mock({runData:{...run,...patch}})}));
 }
});
test('rejects incomplete pagination',async()=>{
 await assert.rejects(()=>inspectRunEvidence({...args,fetchImpl:mock({jobs:{total_count:101,jobs:[]}})}),/pagination/);
});
test('rejects API failure',async()=>{
 await assert.rejects(()=>inspectRunEvidence({...args,fetchImpl:async()=>({ok:false,status:403})}),/403/);
});

test('run-level artifact cannot inherit requested retry attempt',async()=>{
 const result=await inspectRunEvidence({...args,fetchImpl:mock()});
 assert.equal(result.attempt,2);
 assert.equal(result.artifacts[0].runAttempt,null);
 assert.equal(result.artifacts[0].jobId,undefined);
});
