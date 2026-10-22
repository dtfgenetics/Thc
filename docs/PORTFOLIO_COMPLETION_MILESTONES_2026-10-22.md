# DTF portfolio completion milestones — 2026-10-22

Status: **planning baseline, not a production acceptance certificate**. This document is a bounded roadmap anchored in the connected GitHub repository state and public routes observed on 2026-10-22. Reconcile against existing orchestrator epics/jobs before adding any new jobs.

## Current ownership and publication

- `Thc`: current whole-site public routing, static/WordPress release integration and live verification.
- `Tools`: canonical cultivation tools, maths, visualization and Atlas implementation. Do not treat a website mirror as canonical.
- `Thc-dataset`: canonical Grow Doc application, evidence, diagnostic and training data. Its name does not mean it owns the whole 420-lesson encyclopedia.
- `Dtf420`: Next.js migration/cutover work; not yet the whole-site production owner.
- Evidence: repository `AGENTS.md` files and `Thc/AI_CONTEXT.md`.

## Current observations and limitations

- Live `/learn/` returned an educational landing page on 2026-10-22; the historical missing-page issue is no longer a confirmed current failure.
- Live public pages indexed for the game hub and Grow Planner exist. HTML reachability is NOT gameplay, maths, accessibility or backend acceptance.
- GitHub PR searches returned 23 open PRs in Thc, 7 in Tools, 3 in Dtf420, and 0 in Thc-dataset. Counts are snapshots, not immutable backlog totals.
- This plan does not assert a green build, functional game, all 420 lessons published, correct math, approved science, or deployed changes without exact-SHA evidence.

## Milestone gates

### M0 — State convergence and release ownership (first)
Acceptance:
1. Inventory current source owners, site routes, existing epics and open PRs with exact SHAs and workflow status.
2. Classify PRs: merge-ready, repair, superseded, dependent, conflicting; never bulk-merge unverified heads.
3. Resolve duplicate writers for tools, Learn, encyclopedia, games and Grow Doc.
4. Record canonical source->integration revision->public-route chain and rollback path for each production surface.

### M1 — Reliable core visitor journey
Acceptance:
1. Home -> Learn -> Atlas/Encyclopedia/Courses; Home -> Tools -> tool; Home -> Games -> game; Home -> Shop flow works on phone and desktop.
2. Navigation: no missing targets, incorrect redirects or silent SPA shell fallback.
3. Smoke tests validate HTTP status, HTML media type, expected page identity and loadable required assets; test dynamic behaviour separately.
4. Accessibility: keyboard controls, focus visibility, labelling, contrast and responsive overflow reviewed.
5. Captured live verification per route after deployment; all failing routes have tracked owners.

### M2 — Educational tools
Acceptance:
1. Every listed tool has tested input constraints, units, math/reference provenance, result interpretation, reset and error states.
2. Validate VPD (air/leaf temperature and RH), PPFD/DLI, pH/EC/TDS, fertigation, Plant/Terpene Atlas and data persistence against independent fixtures.
3. Canonical Tools revision pinned into public integration with mirror parity and verified live routes.
4. Shared UI foundations used consistently without breaking existing tool contracts.

### M3 — Education and certification
Acceptance:
1. Enumerate permanent Encyclopedia IDs/routes and measure complete-vs-stub status; do not equate a route with an educationally complete lesson.
2. Lessons provide accurate examples, evidence/source display, internal links, useful visual assets with rights and alt text, and responsive tables.
3. Courses are separate from encyclopedia. Assessments grade submitted answers, not preselected choices; preserve learner state and certificate provenance.
4. Review scientific uncertainty and reference freshness, especially microbiome/rhizophagy and diagnostic claims.

### M4 — Grow Doc and GrowLens
Acceptance:
1. Evidence intake, differential reasoning, verification, uncertainty and follow-up workflows tested against known cases and negative controls.
2. Privacy, upload validation, backend permissions, storage retention and safe error states tested.
3. Compare observed public behaviour with canonical source hashes; do not claim deployed solely from a repository build.
4. Confirm datasets preserve provenance, consent/licensing and evaluation separation.

### M5 — Games portfolio
Acceptance:
1. Resolve each game through `data/game-registry-v2.json`, inspect its runtime and named production route.
2. Verify start/play/win-lose/restart, controls, mobile view, assets, persistence and game-specific rules.
3. Multiplayer titles additionally pass multi-client join/rejoin, synchronization, turn authority, information separation and disconnect tests.
4. In-development titles remain visibly marked until playable gates pass; do not advertise concept pages as shipped games.

### M6 — Commerce, community and production operations
Acceptance:
1. Digital purchases: product catalog, checkout, fulfilment delivery, receipts, taxes/legal review, refund/error handling and security tested.
2. Community funnels: consent-gated events, functioning Discord invitations and measurable but privacy-aware analytics.
3. CI gates, deployment approval, rollback, post-deploy smoke tests and performance budgets enforced on exact revisions.
4. Errors, broken links and reliability regressions have actionable observability and owners.

## Scheduling estimates (capacity dependent)

- Core verified website and key tools: 4–8 weeks.
- Expanded education/diagnostics and first group of polished games: 3–5 months.
- Entire planned platform, including content and multiplayer quality: 6–12+ months.
These are planning bands, not commitments. Re-estimate after M0 inventory and throughput samples.

## Next executable actions

1. Triage existing Thc and Tools PRs with duplicate-file and exact-head CI checks, starting with release/tools sync and Tools live verifier.
2. Execute existing `verify:navigation`, `verify:release-integrity`, canonical Tools suite, and representative live browser paths.
3. Repair the first reproducible visitor-facing failure in its canonical repository, add a regression test, review its exact head, and follow production gateway.
4. Publish a route-by-route verified completion scorecard rather than a single unsupported percent complete.

## Required evidence per milestone

Record owner, exact SHA, PR, test command/results, relevant public URL, live timestamp, screenshots/asset checks where helpful, blockers and next action in the existing orchestrator. Do not spawn a parallel work ledger.
