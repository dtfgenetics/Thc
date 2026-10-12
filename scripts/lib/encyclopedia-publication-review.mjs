// Publication authorization and independent scientific approval are different controls.
// Reporting a conflict does not automatically revoke the project owner's publication decision.
export function publicationReviewState(lesson = {}) {
  const control = lesson.reviewControl ?? {};
  const publicationAuthorized = control.publicationAuthorized ?? lesson.publicationAuthorized ?? false;
  const externalReview = String(control.externalReview ?? '').trim();
  return {
    publicationAuthorized: publicationAuthorized === true,
    independentApproval: control.independentApproval === true,
    publicationReviewConflict: publicationAuthorized === true && control.independentApproval === false,
    publicationReviewPending: publicationAuthorized === true &&
      /pending|not_recorded|incomplete|unreviewed/i.test(externalReview)
  };
}
