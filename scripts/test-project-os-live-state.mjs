#!/usr/bin/env node
import assert from 'node:assert/strict';
import {liveFingerprintWorkItems,collectLiveFingerprints,fetchJson} from './collect-project-os-live-state.mjs';
import {fetchJsonWithRetry} from './verify-project-os-release-fingerprint-live.mjs';

const fingerprint={repository:'dtfgenetics/Thc',sourceRevision:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',buildId:'42',bundleHash:'hash',dataHashes:{}};
const queue={items:[
 {workItemId:'a',deployment:{state:'verified',fingerprint}},
 {workItemId:'b',deployment:{state:'verified_live',fingerprint:'legacy'}},
 {workItemId:'c',deployment:{state:'pending',fingerprint:null}},
 {workItemId:'d',deployment:{state:'not_applicable',fingerprint:null}}
]};
assert.deepEqual(liveFingerprintWorkItems(queue).map(x=>x.workItemId),['a','b']);
const seen=[];
const workItems=await collectLiveFingerprints(queue,{fetchFingerprint:async item=>{seen.push(item.workItemId);return fingerprint;}});
assert.deepEqual(seen,['a','b']);
assert.deepEqual(workItems,{a:fingerprint,b:fingerprint});
await assert.rejects(()=>collectLiveFingerprints(queue,{}),/fetchFingerprint is required/);

const good=await fetchJson('https://example/fingerprint',{fetchImpl:async()=>({ok:true,json:async()=>fingerprint})});
assert.deepEqual(good,fingerprint);
await assert.rejects(()=>fetchJson('https://example/404',{fetchImpl:async()=>({ok:false,status:404})}),/request failed: 404/);
await assert.rejects(()=>fetchJson('https://example/array',{fetchImpl:async()=>({ok:true,json:async()=>[]})}),/must be an object/);
await assert.rejects(()=>fetchJson('https://example/missing',{fetchImpl:async()=>({ok:true,json:async()=>({repository:'dtfgenetics/Thc'})})}),/valid Git sourceRevision/);
await assert.rejects(()=>fetchJson('https://example/short',{fetchImpl:async()=>({ok:true,json:async()=>({sourceRevision:'abc'})})}),/valid Git sourceRevision/);
const retryCalls=[];
const revision='a'.repeat(40);
const validFingerprint={sourceRevision:revision,buildId:'test'};
const retried=await fetchJsonWithRetry('https://example/fingerprint',{attempts:2,delayMs:0,fetchImpl:async (url,init)=>{
 retryCalls.push({url,init});
 return retryCalls.length===1?{ok:false,status:503}:{ok:true,json:async()=>validFingerprint};
}});
assert.deepEqual(retried,validFingerprint);
assert.equal(retryCalls.length,2);
assert.ok(retryCalls.every(call=>call.url.includes('project_os_verify=')));
assert.ok(retryCalls.every(call=>call.init.headers.Accept==='application/json'));
await assert.rejects(()=>fetchJsonWithRetry('https://example/array',{attempts:1,fetchImpl:async()=>({ok:true,json:async()=>[]})}),/JSON object/);
await assert.rejects(()=>fetchJsonWithRetry('https://example/malformed',{attempts:1,fetchImpl:async()=>({ok:true,json:async()=>({sourceRevision:'bad'})})}),/valid Git sourceRevision/);
await assert.rejects(()=>fetchJsonWithRetry('https://example/failure',{attempts:1,fetchImpl:async()=>({ok:false,status:502})}),/HTTP 502/);
console.log('Project OS live state collector and HTTP retry verifier tests passed');
