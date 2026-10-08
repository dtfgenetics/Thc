#!/usr/bin/env node
import assert from 'node:assert/strict';
import {buildGithubSnapshot,buildLiveSnapshot} from './build-project-os-reconciliation-snapshot.mjs';

const queue={items:[
 {workItemId:'a',pullRequest:7,deployment:{state:'verified'}},
 {workItemId:'b',pullRequest:8,deployment:{state:'pending'}},
 {workItemId:'c',pullRequest:null,deployment:{state:'not_applicable'}},
 {workItemId:'d',pullRequest:9,deployment:{state:'verified_live'}},
 {workItemId:'e',pullRequest:10,deployment:{state:'failed'}}
]};
const capturedAt='2026-10-06T16:30:00.000Z';
const github=buildGithubSnapshot(queue,[
 {number:7,state:'closed',merged:true,headSha:'aaa',baseSha:'bbb',url:'https://example/7'},
 {number:99,state:'open',merged:false,headSha:'ignore'}
],{capturedAt});
assert.deepEqual(Object.keys(github.pullRequests),['7']);
assert.equal(github.pullRequests['7'].headSha,'aaa');
assert.equal(github.capturedAt,capturedAt);

const live=buildLiveSnapshot(queue,{a:{sourceRevision:'aaa'},b:{sourceRevision:'bbb'},d:{sourceRevision:'ddd'},e:{sourceRevision:'eee'},unknown:{sourceRevision:'x'}},{capturedAt});
assert.deepEqual(Object.keys(live.workItems),['a','d']);
assert.equal(live.workItems.a.sourceRevision,'aaa');
assert.equal(live.workItems.d.sourceRevision,'ddd');
assert.equal(live.workItems.b,undefined);
assert.equal(live.workItems.e,undefined);

assert.deepEqual(buildGithubSnapshot(queue,[],{capturedAt}).pullRequests,{});
assert.deepEqual(buildLiveSnapshot(queue,{}, {capturedAt}).workItems,{});
console.log('Project OS reconciliation snapshot tests passed');
