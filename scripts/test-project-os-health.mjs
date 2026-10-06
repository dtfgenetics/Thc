#!/usr/bin/env node
import assert from 'node:assert/strict';
import {buildHealth,evaluateSlo} from './build-project-os-health.mjs';

assert.equal(evaluateSlo({id:'a',metric:'x',operator:'eq',target:0},{x:0}).status,'pass');
assert.equal(evaluateSlo({id:'a',metric:'x',operator:'gte',target:5},{x:4}).status,'fail');
assert.equal(evaluateSlo({id:'a',metric:'missing',operator:'eq',target:0},{}).status,'unknown');

const queue={items:[
 {workItemId:'a',state:'done',blocker:null},
 {workItemId:'b',state:'failed',blocker:{type:'live_drift'}},
 {workItemId:'c',state:'blocked',blocker:{type:'human_review'}}
]};
const failureMemory={entries:[{occurrences:2},{occurrences:1}]};
const blockers={entries:[
 {state:'open',humanOnly:true},
 {state:'resolved',humanOnly:false}
]};
const slos={targets:[
 {id:'zero',metric:'knownProduction404s',operator:'eq',target:0},
 {id:'tools',metric:'toolRoutesVerified',operator:'gte',target:23}
]};
const health=buildHealth({queue,failureMemory,blockers,slos,metrics:{knownProduction404s:0,toolRoutesVerified:22,generatedAt:'2026-10-06T11:00:00Z'}});
assert.equal(health.queue.active,2);
assert.equal(health.queue.failed,1);
assert.equal(health.failureMemory.recurring,1);
assert.equal(health.blockers.humanOnly,1);
assert.equal(health.slos.pass,1);
assert.equal(health.slos.fail,1);
console.log('Project OS health tests passed');
