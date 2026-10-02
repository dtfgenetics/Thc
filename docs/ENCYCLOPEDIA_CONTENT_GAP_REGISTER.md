# THC Encyclopedia Content Gap Register

Updated: 2026-09-29

## Current controlled coverage

- Controlled architecture: 21 parts × 20 lessons = 420 permanent THC-ENC IDs.
- Repository representation: 420/420 lesson slots.
- Volumes 01–17: 340 individual canonical lesson JSON files.
- Volumes 18–21: 80 controlled draft lessons stored in 16 five-lesson collections.
- Current authority model: Master 420-Entry Content Map v1.1 is the base registry; later controlled Volume 18–21 manuscripts are version-controlled overrides for their ranges.
- Machine-readable authority: `content/encyclopedia/current-controlled-registry.json`.
- Generated canonical manifest: `content/encyclopedia/canonical-420-manifest.json` now projects the controlled registry into one release-facing data contract with exact titles, stable ID routes, Part hubs, A-Z metadata, subject-library mappings, template types, tool integrations, redirect candidates, production gates, and certification-boundary metadata.

## Assessment coverage

All 420 lessons have three lesson-specific effective checks and a materialized rationale draft in `data/encyclopedia-assessment-rationale-package.json`. The rationales are internal reviewer aids, not public answer keys. Independent science and assessment review remains pending, so rationale-draft coverage must not be confused with approval.

## Required lesson content contract

Every lesson must ultimately contain or resolve to:
1. controlled ID, number, title, part, route, and slug;
2. learning objective;
3. key terms / glossary definitions;
4. mechanism / core science;
5. cultivation relevance;
6. measure-and-record guidance;
7. misconceptions;
8. evidence limits;
9. cross-links;
10. source notes;
11. purposeful teaching visual;
12. lesson-specific knowledge checks;
13. answer rationale / assessment review state;
14. revision and release-control state.

## Current priority gaps

1. Independently review the 420 materialized assessment-rationale drafts and preserve reviewer evidence.
2. Produce and approve the 420 teaching visuals from the controlled visual queue; briefs are complete, artwork and asset-level QA are not.
3. Expand exact source-locator / atomic-claim evidence ledgers beyond the initial controlled evidence batch, using the all-source resolution queue to prioritize unresolved references.
4. Volume 20–21 source registers are restored from their controlled manuscripts on the education practical-resource branch. After source-queue regeneration, the 63 previously missing references are expected to resolve as 58 HTTPS-backed volume authorities and 5 internal/non-public placeholders; exact claim locators and independent authority review remain pending.
5. Keep encyclopedia assessment complete on its own. Academy/course links are optional navigation only; course curriculum and certification assessments remain independently controlled.
6. Practical record workbooks now cover THC-ENC-381–420 on the education practical-resource branch, with controlled registry, validation, renderer gating, and discovery-index support. Continue extending practical resources to earlier lessons where they materially improve learning.
7. Maintain release state separately from content existence: draft-complete does not mean independently reviewed, publication-authorized, or live.

## Evidence/data pipeline

- Controlled source registry: `content/encyclopedia/evidence/authoritative-sources.json`.
- Claim evidence batches: `content/encyclopedia/evidence/evidence-batch-001.json` and `content/encyclopedia/evidence/evidence-batch-002.json`.
- Generated risk-priority queue: `data/encyclopedia-evidence-priority.json`.
- Generated 420-lesson tracking artifact: `data/encyclopedia-evidence-tracking.json`.
- All-source resolution queue: `data/encyclopedia-source-resolution-queue.json`.
- Materialized assessment/rationale package: `data/encyclopedia-assessment-rationale-package.json`.
- Controlled visual-production queue: `content/encyclopedia/visual-production-queue-v1.json`.
- Canonical architecture validator: `scripts/validate-encyclopedia-canonical-architecture.mjs`.
- Release-status report: `data/encyclopedia-release-status.json` and `docs/ENCYCLOPEDIA_RELEASE_STATUS.md`.
- Source collection and claim mapping are review-pending by design. They do not approve lessons, change `publicationAuthorized`, or release held drafts.

## Validation commands

- `npm run verify:encyclopedia-content-control`
  - hard-fails structural/content-control identity errors;
  - reports quality and assessment gaps as warnings.

- `npm run audit:encyclopedia-substantive-quality`
  - measures whether lesson fields are substantive rather than merely present;
  - reports weak instructional depth, measurement guidance, misconceptions, evidence limits, source-authority signals, and cross-links.

- `npm run verify:encyclopedia-content-strict`
  - additionally fails unresolved content-quality and assessment-rationale gaps;
  - this remains the target gate for a future 420/420 production-complete release.

- `npm run verify:encyclopedia-evidence`
  - rebuilds the all-lesson evidence tracking artifact;
  - validates authoritative source IDs, evidence-batch links, 420/420 tracking coverage, and review-state boundaries.

- `npm run verify:encyclopedia-production-queues`
  - builds and validates 420/420 assessment-rationale drafts, visual briefs, and source-resolution records;
  - hard-fails any accidental approval or publication-state promotion in generated production queues.

- `npm run verify:encyclopedia-architecture`
  - regenerates the canonical 420 manifest, completion scorecard, evidence tracking, visual queue, discovery index, redirect candidates, and release report;
  - hard-fails duplicate IDs/routes/slugs, broken THC-ENC references, incomplete search records, review-only body leakage, invalid source metadata, missing visual metadata, and published placeholder/draft markers;
  - keeps deployment state truthful by reporting source-only changes as `SOURCE_ONLY_NOT_VERIFIED_LIVE` until visitor-facing verification is performed.

The goal is to make the strict command pass without weakening the standard.
