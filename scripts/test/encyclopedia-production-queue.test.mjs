import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionQueue } from '../lib/encyclopedia-production-queue.mjs';
const complete={id:'THC-ENC-001',number:1,part:1,title:'Complete',exists:true,individualCanonical:true,
  publicationReviewConflict:false,publicationReviewPending:false,sourceCopyIssue:false,placeholderIssue:false,
  objective:true,approvedVisual:true,assessmentMaterialized:true,rationaleComplete:true,visualBriefReady:true,
  terms:3,coreScience:2,measurements:2,pairedMisconceptions:2,crossLinks:2,sources:2,complete:true};
test('flags review conflicts and prioritizes missing source without declaring a pass',()=>{
 const missing={...complete,id:'THC-ENC-002',number:2,exists:false,publicationReviewConflict:true,approvedVisual:false,complete:false};
 const q=buildProductionQueue({lessons:[complete,missing]});
 assert.equal(q.items[0].lessonId,'THC-ENC-002');
 assert.equal(q.items[0].publicationReviewConflict,true);
 assert.equal(q.items[0].gaps.includes('publication_review_conflict'),false);
 assert.ok(q.items[0].gaps.includes('missing_source'));
 assert.equal(q.summary.publicationReviewConflicts,1);
 assert.equal(q.summary.auditCriteriaMet,1);
});
test('identical priority sorts by canonical lesson number',()=>{
 const a={...complete,id:'THC-ENC-002',number:2};
 const q=buildProductionQueue({lessons:[a,complete]});
 assert.equal(q.items[0].lessonId,'THC-ENC-001');
});
test('incomplete scientific coverage becomes explicit actionable gap',()=>{
 const q=buildProductionQueue({lessons:[{...complete,coreScience:1,sources:0}]});
 assert.ok(q.items[0].gaps.includes('insufficient_core_science'));
 assert.ok(q.items[0].gaps.includes('insufficient_source_references'));
});
test('rejects empty audit rather than silently producing zero work',()=>{
 assert.throws(()=>buildProductionQueue({lessons:[]}),/non-empty/);
});

test('approved teaching visual does not require an additional production brief',()=>{
 const q=buildProductionQueue({lessons:[{...complete,visualBriefReady:false}]});
 assert.equal(q.summary.auditCriteriaMet,1);
 assert.equal(q.items[0].gaps.includes('missing_visual_brief'),false);
});
test('duplicate lesson identities reject inconsistent audit inputs',()=>{
 assert.throws(()=>buildProductionQueue({lessons:[complete,{...complete}]}),/Duplicate/);
});
test('invalid encyclopedia identity fails early',()=>{
 assert.throws(()=>buildProductionQueue({lessons:[{...complete,id:'NOT-A-LESSON'}]}),/canonical/);
});

test('independent peer review is tracked as a later handoff, not a content-production gap',()=>{
 const q=buildProductionQueue({lessons:[{...complete,independentApproval:false,
   publicationReviewConflict:true,publicationReviewPending:true}]});
 assert.equal(q.items[0].status,'audit_criteria_met');
 assert.equal(q.items[0].peerReviewPending,true);
 assert.equal(q.items[0].gaps.includes('publication_review_pending'),false);
});

test('review-only hold remains visible without inflating production score',()=>{
 const q=buildProductionQueue({lessons:[{...complete,independentApproval:false,publicationReviewConflict:true,publicationReviewPending:true}]});
 assert.equal(q.items[0].priorityScore,0);
 assert.deepEqual(q.items[0].gaps,[]);
 assert.equal(q.summary.publicationReviewConflicts,1);
 assert.equal(q.summary.publicationReviewPending,1);
 assert.equal(q.summary.auditCriteriaMet,1);
});
