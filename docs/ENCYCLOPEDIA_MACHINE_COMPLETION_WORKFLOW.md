# THC Encyclopedia Machine Completion Workflow

Updated: 2026-10-04

## Purpose

The 420-lesson Encyclopedia is already published at the canonical text/search layer. Remaining work contains two fundamentally different classes:

1. machine-completable production work; and
2. release-critical checks (scientific accuracy, sources, accessible visuals, content integrity, and deployment) distinct from optional general-lesson assessment drafts and Academy-only credential checks.

The machine-completion queue prevents those states from being conflated.

## Commands

- `npm run build:encyclopedia-machine-work`
  - rebuilds the existing production-readiness artifact;
  - materializes `data/encyclopedia-machine-work-queue.json`.

- `npm run verify:encyclopedia-machine-work`
  - builds the queue;
  - enforces the machine/human boundary.

The project-wide `verify:project-os` gate now includes this verification.

## Machine-production actions

Only these actions are allowed in the autonomous production queue:

- `repair_lesson_content_contract`
- `map_atomic_claim_evidence`
- `resolve_source_authority_and_exact_locator`
- `produce_teaching_visual_candidate`

A produced visual candidate is not an approved teaching asset.

## Review-only actions

These remain outside the autonomous completion queue:

- optional external claim/evidence peer review (not required to publish informational lessons);
- optional general-lesson assessment-rationale review (not a release blocker);
- teaching-visual rights, scientific accuracy, accessibility and public-serving verification where a visual is actually published;
- publication/deployment verification;
- Academy-only credential, scoring, psychometric or accreditation work (tracked separately).

## Operating rule

Automation should repeatedly drain `machineProductionQueue` in priority order. When a lesson has no remaining machine action, it may still appear in `reviewQueue` or `externalHumanQueue`. A pending optional peer review or general-lesson assessment must **not** block informational lesson completion or deployment. Real source, accessibility, rights, and deployment defects still block the affected release. The current queue implementation may still encode older assumptions; inspect and repair its executable logic before treating these instructions as proof of CI compliance.

The protected 420-lesson core remains stable. New subject matter belongs in the controlled 421+ extension layer rather than renumbering or replacing the core.
