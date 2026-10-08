#!/usr/bin/env node
import assert from 'node:assert/strict';
import {applyReconciliation,reconcile} from './reconcile-project-os-state.mjs';

const item={workItemId:'w1',state:'done',pullRequest:7,headSha:'abc',deployment:{state:'verified',fingerprint:{sourceRevision:'abc'}}};
const good=reconcile({items:[item]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{w1:{sourceRevision:'abc'}});
assert.equal(good.ok,true);
assert.equal(good.summary.drifted,0);

const verifiedLive={...item,deployment:{...item.deployment,state:'verified_live'}};
assert.equal(reconcile({items:[verifiedLive]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{}).items[0].issues.some(x=>x.code==='live_evidence_missing'),true,'verified_live must not bypass missing live evidence');
assert.equal(reconcile({items:[verifiedLive]},{pullRequests:{'7':{state:'closed',merged:true,headSha:'abc'}}},{w1:{sourceRevision:'old'}}).items[0].issues.some(x=>x.code==='live_revision_drift'),true,'verified_live must reject wrong deployed revision');

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

const checkedAt='2026-10-06T16:20:00.000Z';
const mutated=applyReconciliation({updatedAt:'old',items:[item]},liveDrift,{checkedAt});
assert.equal(mutated.items[0].state,'failed');
assert.equal(mutated.items[0].blocker.type,'state_drift');
assert.deepEqual(mutated.items[0].evidence.at(-1),{type:'reconciliation_drift',checkedAt,issues:['live_revision_drift']});
assert.equal(mutated.items[0].timestamps.updatedAt,checkedAt);
const twice=applyReconciliation(mutated,liveDrift,{checkedAt});
assert.deepEqual(twice,mutated,'same reconciliation evidence must be idempotent');
const cleanMutation=applyReconciliation({items:[item]},good,{checkedAt});
assert.equal(cleanMutation.items[0].state,'done','clean reconciliation must not rewrite work state');
console.log('Project OS actionable reconciliation tests passed');
