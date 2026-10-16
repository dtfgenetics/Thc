import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, acceptedForRelease, fingerprint, reviewRecordValid } from './build-project-quality-report.mjs';
test('missing evidence is blocked rather than inferred complete', () => {
 const report=summarize([{file:'bad.json',manifest:{project:'example',release:'v1',productionUrl:'https://dtfseeds.com',gates:{}}}]);
 assert.equal(report.totals.blocked,1);
 assert.equal(report.totals.independentlyVerified,0);
 assert.equal(report.projects[0].gates.visual,'blocked');
});
test('empty manifests do not invent completion',()=> {
 const report=summarize([]);
 assert.deepEqual(report.totals,{projects:0,blocked:0,pendingReview:0,reviewRecorded:0,independentlyVerified:0});
});

test('self-reported complete evidence does not grant release acceptance',()=>{
 const manifest={project:'THC',release:'v1',productionUrl:'https://dtfseeds.com',gates:{}};
 for (const name of ['functional','scientific','visual','deployment','outcome']) manifest.gates[name]={status:'passed',checkedAt:'2026-10-16T18:00:00Z',evidence:['https://github.com/dtfgenetics/Thc/actions']};
 const report=summarize([{file:'claimed.json',manifest}]);
 assert.equal(report.totals.blocked,0);
 assert.equal(report.totals.pendingReview,1);
 assert.equal(acceptedForRelease(report),false);
});
test('empty report cannot pass release decision',()=>assert.equal(acceptedForRelease(summarize([])),false));

test('hash-bound review is recorded but is not cryptographic identity proof',()=>{
 const manifest={project:'THC',release:'v1',productionUrl:'https://dtfseeds.com',gates:{}};
 for(const name of ['functional','scientific','visual','deployment','outcome']) manifest.gates[name]={status:'passed',checkedAt:'2026-10-16T18:00:00Z',evidence:['https://github.com/dtfgenetics/Thc/actions']};
 const review={project:'THC',release:'v1',manifestSha256:fingerprint(manifest),decision:'approved',reviewer:'a-reviewer',reviewedAt:'2026-10-16T19:00:00Z',reviewUrl:'https://github.com/dtfgenetics/Thc/pull/2499'};
 assert.equal(reviewRecordValid(manifest,review),true);
 const report=summarize([{file:'record.json',manifest}],[review]);
 assert.equal(report.totals.reviewRecorded,1);
 assert.equal(report.totals.independentlyVerified,0);
 assert.equal(acceptedForRelease(report),false);
 manifest.release='v2';
 assert.equal(reviewRecordValid(manifest,review),false);
});
