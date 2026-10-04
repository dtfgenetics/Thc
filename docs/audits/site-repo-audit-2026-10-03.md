# DTF site and repository audit — 2026-10-03 UTC

This file is a current-state audit note, not a frozen early-day snapshot. Generated CI artifacts and fresh production verification take precedence over older counts recorded elsewhere in the repository.

## Education state

| Area | Current verified state | Remaining work |
|---|---|---|
| THC Plant Science Encyclopedia canonical content | **420/420 controlled lessons represented; 420/420 pass the strict substantive lesson audit.** | Continue evidence depth, visual production, independent review, and live/source convergence. |
| Encyclopedia assessments | **420/420 lessons have effective lesson-specific checks and three materialized draft answer rationales (1260 drafts).** | Independent rationale review remains pending; draft rationales must not be treated as approved/public answer keys. |
| Encyclopedia evidence | **420/420 lessons tracked; 158 lessons have claim-evidence mappings, 262 remain unmapped in the latest generated audit; 113 authoritative sources and 165 claim-evidence records are tracked.** | Research/mapping can continue automatically; evidence review/approval remains an independent-review task. |
| Encyclopedia visuals | **420/420 controlled visual briefs; 48 produced assets are review-pending; 372 assets still require production; 0 are recorded approved.** | Produce remaining teaching visuals and run subject-accuracy/responsive review. Do not synthesize approval. |
| Encyclopedia source tracking | **900 unique source references tracked; 150 centrally resolved in the latest generated source queue.** | Continue resolution and claim-level binding without changing review state automatically. |
| Encyclopedia discovery/search | **420 controlled entries and 21 Parts are represented by the deterministic discovery architecture.** | Keep generated discovery/search records synchronized with the completed publication cutoff and production state. |
| Certification curriculum | **15 canonical Technician certification courses / 284 canonical lessons remain separate from the Encyclopedia.** | Manual responsive/accessibility QA and real external validation/standard-setting/credential evidence remain open. |
| Course terminology boundary | Production course surfaces are restricted to the canonical certification namespace; preserved historical noncredential packages are not active public courses. | Keep legacy/migration content available only as reference/development material unless explicitly migrated into certification. |

## Production findings

- The canonical Encyclopedia publisher, topic organizer, search index publication, visitor checks, live-copy audit, and protected repair lane are implemented.
- A stale production-copy audit previously exposed malformed source labels and generic misconception placeholders on already-published WordPress pages. Canonical source is guarded against republishing those defects; production reconciliation is tracked by the dedicated live-copy repair workflow.
- The Learn root has one canonical automatic owner: Learning Experience V3. A legacy reconciliation workflow was converted to read-only verification so it cannot overwrite the owner.
- Authenticated WordPress storage has shown the current Learn content while visitor rendering exposed stale compatibility output. The guarded owner-recovery lane verifies stored canonical content before disabling only the exact known stale renderer and requires fresh visitor acceptance afterward.
- A completed Encyclopedia publication pointer was advanced through THC-ENC-420 and later overwritten by a stale Part 19 release commit. Current repair work adds a monotonic publication floor so historical/replay batches cannot move the completed cutoff backward.
- Website publication is not equivalent to independent science approval. `independentApproval`, evidence-review, visual-review, rationale-review, and professional credential gates remain separate controls.

## Replaced findings

The following earlier findings are **retired** and must not be used as current work queues:

- “178/420 encyclopedia lessons have substantive gaps.” The current strict substantive audit reports **0/420 with substantive findings**.
- The earlier per-category thin-content counts (weak source authority, thin measurements, thin misconceptions, etc.) were heuristic screening results from an older source state and are not current completion metrics.
- “340 assessment warnings.” Current controlled assessment coverage is **420/420**, with lesson-specific checks and materialized draft rationales.
- “WordPress credentials are absent / source correction is not live.” Protected production workflows have authenticated WordPress publication and rollback lanes; live state must be determined from current workflow/run evidence rather than that earlier statement.

## Completion boundary

Repository/source completeness is not the same as independent review completion. The project may truthfully report that all 420 controlled lessons have substantive canonical content while still showing review-pending evidence, visuals, and rationales. Automation may create sources, mappings, candidate visuals, QA evidence, and review packages; it must not fabricate human reviewer decisions, psychometric validation, accessibility sign-off, credential authorization, or pilot results.

## Audit rule for future work

Before opening a repair PR from an old branch or audit:
1. inspect current `main`;
2. regenerate or read the latest Encyclopedia CI artifacts;
3. check active PRs/workflows for overlapping ownership;
4. preserve the one-writer production model;
5. use separate historical/repair manifests instead of moving completed publication pointers backward;
6. verify visitor state independently after production mutation.
