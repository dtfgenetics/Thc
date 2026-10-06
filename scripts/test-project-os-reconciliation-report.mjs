#!/usr/bin/env node
import assert from 'node:assert/strict';
import {buildReport} from './generate-project-os-reconciliation-report.mjs';

const item={workItemId:'w1',state:'done',pullRequest:7,headSha:'abc',deployment:{state:'verified',fingerprint:{sourceRevision:'abc'}}};
const queue={items:[item]};
const github={pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}};
const live={workItems:{w1:{sourceRevision:'abc'}}};
const opts={generatedAt:'2026-10-06T16:45:00.000Z',sourceRevision:'deadbeef'};
const good=buildReport(queue,github,live,opts);
assert.equal(good.ok,true);
assert.deepEqual(good.summary,{checked:1,drifted:0});
assert.deepEqual(good.drift,[]);
assert.equal(good.generatedAt,opts.generatedAt);
assert.equal(good.sourceRevision,opts.sourceRevision);

const drift=buildReport(queue,github,{workItems:{w1:{sourceRevision:'old'}}},opts);
assert.equal(drift.ok,false);
assert.equal(drift.summary.drifted,1);
assert.equal(drift.drift[0].workItemId,'w1');
assert.ok(drift.drift[0].issues.some(x=>x.code==='live_revision_drift'));
console.log('Project OS reconciliation report tests passed');
