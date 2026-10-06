#!/usr/bin/env node
import assert from 'node:assert/strict';
import {reconcile} from './reconcile-project-os-state.mjs';

const item={workItemId:'w1',state:'done',pullRequest:7,headSha:'abc',deployment:{state:'verified',fingerprint:{sourceRevision:'abc'}}};
const good=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{w1:{sourceRevision:'abc'}});
assert.equal(good.ok,true);
assert.equal(good.summary.drifted,0);

const headDrift=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'def'}}},{w1:{sourceRevision:'abc'}});
assert.equal(headDrift.ok,false);
assert.ok(headDrift.items[0].issues.some(x=>x.code==='github_head_drift'));

const unmerged=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:false,headSha:'abc'}}},{w1:{sourceRevision:'abc'}});
assert.ok(unmerged.items[0].issues.some(x=>x.code==='done_pr_not_merged'));

const missingLive=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{});
assert.ok(missingLive.items[0].issues.some(x=>x.code==='live_evidence_missing'));

const liveDrift=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{w1:{sourceRevision:'old'}});
assert.ok(liveDrift.items[0].issues.some(x=>x.code==='live_revision_drift'));

const active={...item,state:'in_progress',deployment:{state:'not_applicable',fingerprint:null}};
const closed=reconcile({items:[active]},{pullRequests:{'7':{state:'closed',merged:false,headSha:'abc'}}},{});
assert.ok(closed.items[0].issues.some(x=>x.code==='active_pr_closed_unmerged'));
console.log('Project OS state reconciliation tests passed');
