import assert from 'node:assert/strict';
import test from 'node:test';
import { publicationReviewState } from '../lib/encyclopedia-publication-review.mjs';

test('flags owner-authorized lesson whose independent approval is explicitly false', () => {
  assert.deepEqual(publicationReviewState({
    publicationAuthorized: true,
    reviewControl: { publicationAuthorized: true, independentApproval: false, externalReview: 'pending_not_recorded' }
  }), {
    publicationAuthorized: true,
    independentApproval: false,
    publicationReviewConflict: true,
    publicationReviewPending: true
  });
});

test('does not flag properly reviewed publication', () => {
  const state = publicationReviewState({ reviewControl: {
    publicationAuthorized: true, independentApproval: true, externalReview: 'review_complete'
  } });
  assert.equal(state.publicationReviewConflict, false);
  assert.equal(state.publicationReviewPending, false);
});

test('draft with pending review is not a publication conflict', () => {
  const state = publicationReviewState({ publicationAuthorized: false, reviewControl: {
    independentApproval: false, externalReview: 'pending'
  } });
  assert.equal(state.publicationReviewConflict, false);
  assert.equal(state.publicationReviewPending, false);
});

test('no metadata does not count as approved or conflict', () => {
  const state = publicationReviewState({});
  assert.equal(state.publicationAuthorized, false);
  assert.equal(state.independentApproval, false);
  assert.equal(state.publicationReviewConflict, false);
});
