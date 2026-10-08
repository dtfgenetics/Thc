#!/usr/bin/env node
import assert from 'node:assert/strict';
import {liveFingerprintWorkItems,collectLiveFingerprints,fetchJson} from './collect-project-os-live-state.mjs';

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
console.log('Project OS live state collector tests passed');
