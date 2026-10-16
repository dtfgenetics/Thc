import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './build-project-quality-report.mjs';
test('missing evidence is blocked rather than inferred complete', () => {
 const report=summarize([{file:'bad.json',manifest:{project:'example',release:'v1',productionUrl:'https://dtfseeds.com',gates:{}}}]);
 assert.equal(report.totals.blocked,1);
 assert.equal(report.totals.independentlyVerified,0);
 assert.equal(report.projects[0].gates.visual,'blocked');
});
test('empty manifests do not invent completion',()=> {
 const report=summarize([]);
 assert.deepEqual(report.totals,{projects:0,blocked:0,pendingReview:0,independentlyVerified:0});
});
