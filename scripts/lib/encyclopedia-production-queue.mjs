const fields = [
  ['exists', 'missing_source', 100],
  ['individualCanonical', 'noncanonical_source', 80],
  ['sourceCopyIssue', 'malformed_source_reference', 75, true],
  ['placeholderIssue', 'generic_placeholder', 75, true],
  ['objective', 'missing_objective', 35],
  ['approvedVisual', 'missing_approved_visual', 55],
  ['assessmentMaterialized', 'missing_materialized_assessment', 45],
  ['rationaleComplete', 'missing_rationale', 45],
  ['visualBriefReady', 'missing_visual_brief', 25],
];
export function buildProductionQueue(audit) {
  if (!audit || !Array.isArray(audit.lessons) || !audit.lessons.length) {
    throw new Error('A non-empty encyclopedia learning-quality audit is required.');
  }
  const seenIds = new Set();
  for (const row of audit.lessons) {
    if (!row || typeof row.id !== 'string' || !/^THC-ENC-\d{3,}$/.test(row.id)) {
      throw new Error('Every lesson must have a canonical THC-ENC-### ID.');
    }
    if (seenIds.has(row.id)) throw new Error('Duplicate encyclopedia lesson ID: ' + row.id);
    seenIds.add(row.id);
  }
  const rows = audit.lessons.map(row => {
    const gaps = fields.filter(([field, , , whenTrue]) => whenTrue ? row[field] === true : row[field] !== true)
      .map(([, code, weight]) => ({code, weight}));
    if ((row.terms ?? 0) < 3) gaps.push({code:'missing_glossary_terms',weight:30});
    if ((row.coreScience ?? 0) < 2) gaps.push({code:'insufficient_core_science',weight:60});
    if ((row.measurements ?? 0) < 2) gaps.push({code:'missing_measurements',weight:40});
    if ((row.pairedMisconceptions ?? 0) < 2) gaps.push({code:'missing_explained_misconceptions',weight:30});
    if ((row.crossLinks ?? 0) < 2) gaps.push({code:'missing_crosslinks',weight:25});
    if ((row.sources ?? 0) < 2) gaps.push({code:'insufficient_source_references',weight:65});
    // A missing visual brief is actionable but does not undo an already approved visual.
    if (row.approvedVisual === true) {
      const briefIndex = gaps.findIndex(gap => gap.code === 'missing_visual_brief');
      if (briefIndex >= 0) gaps.splice(briefIndex, 1);
    }
    // Scientific peer review is a separate handoff AFTER content production.
    // Content quality, citations, diagrams and assessments drive this queue.
    const score = gaps.reduce((total, gap) => total + gap.weight, 0);
    return {lessonId:row.id, number:row.number, title:row.title, part:row.part,
      sourceFile:row.sourceFile ?? null, authorized:row.publicationAuthorized === true,
      completionRecorded:row.complete === true, peerReviewPending:row.independentApproval !== true,
      publicationReviewConflict:row.publicationReviewConflict === true,
      publicationReviewPending:row.publicationReviewPending === true, priorityScore:score,
      status:gaps.length ? 'needs_work' : 'audit_criteria_met',
      gaps:gaps.map(({code}) => code)};
  }).sort((a,b) => b.priorityScore-a.priorityScore ||
    (a.number??Infinity)-(b.number??Infinity) || String(a.lessonId).localeCompare(String(b.lessonId)));
  const gapTotals = {};
  for (const row of rows) for (const code of row.gaps) gapTotals[code]=(gapTotals[code]??0)+1;
  return {schemaVersion:1, source:'data/encyclopedia-learning-quality-audit.json',
    warning:'Production queue prioritizes content and assets. Independent peer review is a subsequent team handoff, not a prerequisite to completing drafts. Rubric coverage does not prove scientific claims or deployment.',
    summary:{total:rows.length,needsWork:rows.filter(r=>r.gaps.length).length,
      auditCriteriaMet:rows.filter(r=>!r.gaps.length).length,
      publicationReviewConflicts:rows.filter(r=>r.publicationReviewConflict).length,
      publicationReviewPending:rows.filter(r=>r.publicationReviewPending).length,gapTotals},
    items:rows};
}
