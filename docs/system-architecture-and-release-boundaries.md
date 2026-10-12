# DTF System Architecture and Release Boundaries

Status: proposed architecture contract (audit baseline, 2026-10-11). This document describes intended ownership; it does **not** certify live deployment, test success, or the completeness of any application.

## System map

| Boundary | Canonical repository | Responsibility |
| --- | --- | --- |
| Public integration / application shell and games workspace | `dtfgenetics/Thc` | Portfolio contracts, navigation and release integrity, connected game experiences, integration/release checks |
| Cultivation tools | `dtfgenetics/Tools` | Tool implementations, calculator and Atlas contracts, tool-specific unit/integration tests |
| Scientific and educational data | `dtfgenetics/Thc-dataset` | Versioned source/evidence records, educational datasets and supporting metadata |
| Independent site/game prototype | `dtfgenetics/Dtf420` | Next.js application and game experiments; **not** an automatic authoritative source for production |
| Grow Doc | `dtfgenetics/thc-grow-hub` (verify actual deployment relationship before asserting ownership) | Model/data validation, inference and diagnostic evaluation contracts |

The table is an ownership proposal for review. A deployable artifact may be assembled from more than one repository. The public domain must be mapped to a concrete deploying repository, commit, workflow and artifact before that mapping is considered confirmed.

## Non-negotiable dependency rules

1. Keep one authoritative writer per artifact or content family. Mirrors are generated consumers, not second authoring sources.
2. Any synchronization must record source repository, source commit SHA, content manifest/hash and target commit SHA.
3. Never overwrite modified destination content silently. Compare semantic payloads, fail closed on destructive changes and emit a machine-readable conflict report.
4. Publish from a pinned immutable source revision, using concurrency control and compare-and-swap / branch lease semantics. Never use unconditional force push for a shared release branch.
5. A consumer cannot independently declare source evidence or imagery approved. Asset publication requires provenance, rights, technical validity and evidence-level gates.
6. Persist runtime state outside source-control artifacts and maintain schema migrations for durable records.
7. Prefer integration contracts over copying application internals between repositories; cross-repo references should use pinned versions/SHAs and explicit compatibility tests.
8. Avoid re-implementing the same scientific formula in site, tools and data adapters. Choose one tested canonical implementation and verify consumers against shared fixtures.

## Change lifecycle

```text
issue / observed defect
  -> reproduce against named commit + environment
  -> identify owner and competing branches/PRs
  -> smallest safe fix + regression test
  -> unit / typecheck / lint / static route / contract checks
  -> build + accessibility + browser / runtime smoke checks
  -> independent exact-head CI and security scan
  -> reviewed merge to protected main
  -> deploy immutable artifact
  -> post-deploy verification + rollback pointer
```

Merge eligibility must be based on the **current head SHA**, not a previous successful CI run or an unverified PR description. Stale/superseded proposals should be reconciled before merging. No direct-main emergency changes without a documented incident, post-change test and rollback plan.

## Verification matrix

| Surface | Minimum automated gate | Additional release evidence |
| --- | --- | --- |
| Main site | install, lint/typecheck where applicable, package test, production build, route/link checks | mobile and desktop browser smoke; accessibility; 404/asset checks |
| Tools and Atlas | deterministic calculation/unit fixture tests, contract/ownership checks | interactive controls, measured correctness, source/visual evidence |
| Encyclopedia / Academy | schema, permanent-ID uniqueness, searchable index, source/link integrity | visual placement and publish eligibility, learner flows, certification integrity |
| Grow Doc / diagnostics | provenance and split-leakage audits, held-out evaluation, schema validators | runtime integration, abstention and failure handling |
| Games | deterministic rules/engine tests, lobby/state contract, asset validation | human/browser playtest, mobile controls, multiplayer where supported |
| Deploy pipelines | least-privilege workflow permissions, pinned external actions, branch protection | exact-head CI, artifact SHA and provenance, rollback smoke check |

Coverage is **unknown** until each gate is run and its output captured. A script existing in `package.json` does not establish a passing release gate.

## Current investigation queue (2026-10-11)

- Reconcile `Thc` PRs #2413, #2407, #2405, and #2404 for one non-destructive, leased Atlas mirror implementation. Do not merge overlapping patches blindly.
- Review `Thc` PR #2418 for validated PNG publication gates against the latest commit and actual media.
- Review `Tools` PRs #193, #188, #186 and #165 for visual completeness, overlap, and exact-head CI.
- Validate `Thc-dataset` PR #518 without relaxing provenance, rights or review requirements.
- Trace the live `dtfseeds.com` deployment back to its deployable source and commit; no repository alone is assumed to be the live source.
- Inventory duplicate/legacy repositories and references before archiving; preserve redirect/build and operational dependencies.

## Definition of done

A release is complete only when: (a) source of truth is declared, (b) the defect is reproducible before and covered afterward, (c) relevant tests actually pass for the merged commit, (d) the deployed artifact matches that commit, (e) mobile/desktop interaction is verified, and (f) rollback evidence is available. Unknowns remain open; they are never counted as passes.
