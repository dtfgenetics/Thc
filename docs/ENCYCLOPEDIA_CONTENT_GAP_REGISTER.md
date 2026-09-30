# THC Encyclopedia Content Gap Register

Updated: 2026-09-29

## Current controlled coverage

- Controlled architecture: 21 parts × 20 lessons = 420 permanent THC-ENC IDs.
- Repository representation: 420/420 lesson slots.
- Volumes 01–17: 340 individual canonical lesson JSON files.
- Volumes 18–21: 80 controlled draft lessons stored in 16 five-lesson collections.
- Current authority model: Master 420-Entry Content Map v1.1 is the base registry; later controlled Volume 18–21 manuscripts are version-controlled overrides for their ranges.
- Machine-readable authority: `content/encyclopedia/current-controlled-registry.json`.

## Assessment coverage

After this repair:
- Volumes 18–21: 80/80 draft lessons contain three lesson-specific checks:
  - application;
  - measurement / verification;
  - misconception or evidence-limit challenge.
- Volumes 01–17: 340 lessons still require a formal lesson-level knowledge-check layer or linked assessment-bank entry.
- Answer rationales and independent assessment review remain pending for Volumes 18–21.

This means 420/420 lessons exist, but the encyclopedia is **not yet 420/420 assessment-complete**.

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

1. Build lesson-specific knowledge checks and answer rationales for THC-ENC-001–340.
2. Run strict content-quality validation across all 420 and repair thin objectives, source coverage, terms, misconceptions, measurement guidance, and cross-links.
3. Build the controlled visual-production queue from the current registry and volume-specific visual briefs.
4. Expand exact source-locator / atomic-claim evidence ledgers beyond the initial controlled evidence batch.
5. Keep encyclopedia assessment complete on its own. Academy/course links are optional navigation only; course curriculum and certification assessments remain independently controlled.
6. Add/download printable measurement sheets, decision aids, sampling forms, or checklists where the lesson benefits from one.
7. Maintain release state separately from content existence: draft-complete does not mean independently reviewed, publication-authorized, or live.

## Evidence/data pipeline

- Controlled source registry: `content/encyclopedia/evidence/authoritative-sources.json`.
- Initial claim evidence batch: `content/encyclopedia/evidence/evidence-batch-001.json`.
- Generated 420-lesson tracking artifact: `data/encyclopedia-evidence-tracking.json`.
- Source collection and claim mapping are review-pending by design. They do not approve lessons, change `publicationAuthorized`, or release held drafts.

## Validation commands

- `npm run verify:encyclopedia-content-control`
  - hard-fails structural/content-control identity errors;
  - reports quality and assessment gaps as warnings.

- `npm run verify:encyclopedia-content-strict`
  - additionally fails unresolved content-quality and assessment coverage gaps;
  - this is the target gate for a future 420/420 production-complete release.

- `npm run verify:encyclopedia-evidence`
  - rebuilds the all-lesson evidence tracking artifact;
  - validates authoritative source IDs, evidence-batch links, 420/420 tracking coverage, and review-state boundaries.

The goal is to make the strict command pass without weakening the standard.
