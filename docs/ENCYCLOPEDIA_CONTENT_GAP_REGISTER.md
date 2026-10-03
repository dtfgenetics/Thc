# THC Encyclopedia Content Gap Register

Updated: 2026-10-03

## Current controlled coverage

- Controlled architecture: 21 parts × 20 lessons = 420 permanent THC-ENC IDs.
- Repository representation: 420/420 lesson slots.
- Canonical lesson reader currently resolves all 420 controlled lessons to individual canonical lesson files for validation and publication tooling.
- Historical five-lesson collection manuscripts remain source/control records where retained, but they are not the substantive-audit authority when an individual canonical lesson exists.
- Current authority model: Master 420-Entry Content Map v1.1 is the base registry; later controlled Volume 18–21 manuscripts are version-controlled overrides for their ranges.
- Machine-readable authority: `content/encyclopedia/current-controlled-registry.json`.

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

1. Independently review the 420 materialized assessment-rationale drafts and preserve reviewer evidence. All 1260 rationale drafts remain review-pending; draft completeness is not approval.
2. Complete teaching-visual production and independent asset review. Repository inventory currently contains lesson-prefixed canonical artwork for 48 controlled lesson IDs (67 lesson-specific files); these are produced candidates, not approved assets. The remaining 372 lesson IDs still need lesson-specific artwork unless a later controlled asset is mapped.
3. Expand exact source-locator / atomic-claim evidence ledgers using the all-source resolution queue. Repository evidence inventory currently maps 125/420 lessons through 132 claim-evidence records and 94 controlled authorities across 15 batches; all mappings remain pending independent science review.
4. Volume 20–21 source registers are restored from their controlled manuscripts on the education practical-resource branch. After source-queue regeneration, the 63 previously missing references are expected to resolve as 58 HTTPS-backed volume authorities and 5 internal/non-public placeholders; exact claim locators and independent authority review remain pending.
5. Keep encyclopedia assessment complete on its own. Academy/course links are optional navigation only; course curriculum and certification assessments remain independently controlled.
6. Practical record workbooks now cover THC-ENC-381–420 on the education practical-resource branch, with controlled registry, validation, renderer gating, and discovery-index support. Continue extending practical resources to earlier lessons where they materially improve learning.
7. Maintain release state separately from content existence: draft-complete does not mean independently reviewed, publication-authorized, or live.

## Evidence/data pipeline

- Controlled source registry: `content/encyclopedia/evidence/authoritative-sources.json`.
- Claim evidence batches: `content/encyclopedia/evidence/evidence-batch-001.json` through `content/encyclopedia/evidence/evidence-batch-015.json`.
- Shared-source bridge: Batch 003 maps the canonical PubChem, USDA GRIN, USDA Hemp Phenotyping v4, MIAPPE v1.2, and Cornell hemp genetics/germplasm identities into scoped encyclopedia claims without changing publication state.
- Disease/diagnostic evidence: Batch 004 adds scoped Cornell and Oregon State Extension support for heat-stress differentials, Botrytis, Fusarium, HLVd, site risk, scouting records, and cultivar/environment generalization limits; all mappings remain pending independent science review.
- Part 10/11 evidence expansion: Batches 009–011 convert existing cannabis architecture, training, photoperiod, reproductive-development, pollen, fertilization, seed-maturity, sex-expression, and reproductive-record research into controlled claim mappings without changing review or publication state.
- Part 12/13 evidence expansion: Batches 012–015 add bounded primary-source mappings for trichome biology, cannabinoid biosynthesis/analysis, terpenes, volatile chemistry, postharvest stability, chemovar interpretation, and entourage-claim boundaries; all remain pending independent science review.
- Generated risk-priority queue: `data/encyclopedia-evidence-priority.json`.
- Generated 420-lesson tracking artifact: `data/encyclopedia-evidence-tracking.json`.
- All-source resolution queue: `data/encyclopedia-source-resolution-queue.json`.
- Materialized assessment/rationale package: `data/encyclopedia-assessment-rationale-package.json`.
- Controlled visual-production queue: `content/encyclopedia/visual-production-queue-v1.json`.
- Source collection and claim mapping are review-pending by design. They do not approve lessons, change `publicationAuthorized`, or release held drafts.

## Validation commands

- `npm run verify:encyclopedia-content-control`
  - hard-fails structural/content-control identity errors;
  - reports quality and assessment gaps as warnings.

- `npm run audit:encyclopedia-substantive-quality`
  - measures whether lesson fields are substantive rather than merely present;
  - reports weak instructional depth, measurement guidance, misconceptions, evidence limits, source-authority signals, and cross-links.
  - latest completed production CI reported 420/420 lessons with zero substantive findings; preserve this gate while evidence/review/visual work continues.

- `npm run verify:encyclopedia-content-strict`
  - additionally fails unresolved completion/review gaps after substantive lesson quality has passed;
  - this remains the target gate for a future 420/420 production-complete release and must not be weakened to bypass independent review.

- `npm run verify:encyclopedia-evidence`
  - rebuilds the all-lesson evidence tracking artifact;
  - validates authoritative source IDs, evidence-batch links, 420/420 tracking coverage, and review-state boundaries.

- `npm run verify:encyclopedia-production-queues`
  - builds and validates 420/420 assessment-rationale drafts, visual briefs, and source-resolution records;
  - hard-fails any accidental approval or publication-state promotion in generated production queues.

The goal is to make the strict command pass without weakening the standard.


## Unified production-readiness artifact

- Generated artifact: `data/encyclopedia-production-readiness.json`.
- Builder: `scripts/build-encyclopedia-production-readiness.mjs`.
- Validator: `scripts/validate-encyclopedia-production-readiness.mjs`.
- Scope: one readiness row for each controlled THC-ENC lesson.
- Readiness combines the existing lesson-contract scorecard, evidence/source tracking, teaching-visual queue, assessment-rationale review state, optional practical-resource coverage, and publication authorization.
- Academy/Course membership is explicitly excluded as an Encyclopedia completion or release requirement.
- Baseline validation checks identity, state consistency, and release-boundary preservation.
- Strict validation fails until all 420 lessons are truly release-ready; do not weaken the strict gate to make unfinished work appear complete.


## Canonical source pin

- Canonical authoring repository: `dtfgenetics/thc-grow-hub`.
- Production integration source target: `site/wordpress/education/encyclopedia-deployment-target.json`.
- The target must use a full immutable 40-character commit SHA; production integration must not float on `main`.
- Resolver: `scripts/resolve-encyclopedia-deployment-target.mjs`.
- Validator: `scripts/validate-encyclopedia-source-pin.mjs`.
- Environment handoff: `THC_ENCYCLOPEDIA_SOURCE_SHA`.
- This is a source-target contract only. It does not by itself prove byte-for-byte parity, scientific approval, or publication authorization.
