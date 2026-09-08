---
name: rirt
description: Diagnose and eliminate recurring/systemic defects across DTF games, education, website, assets, infrastructure, repositories, and production delivery by resolving ownership, tracing full throughput, researching authoritative fixes, routing to the correct specialist skill, enforcing risk-based deterministic verification, and recording repair memory.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with GitHub/repository and web research access. Works under dtf-system-orchestrator and must not replace canonical subsystem skills.
metadata:
  author: dtfgenetics
  version: "2.0.0"
---

# RIRT — Recurring Issue Research, Integration, Reliability & Throughput

Use this skill when the same or similar failure appears repeatedly, when a problem crosses repositories or runtime boundaries, when ownership is unclear, when a fix passes locally but not downstream, or when repository state differs from live behavior.

## Authority and relationship to existing skills

RIRT is a diagnostic/routing layer under `.agents/skills/dtf-system-orchestrator/SKILL.md`.
It does not replace `github-repo-manager`, `dtf-parallel-studio`, `dtf-game-production`, `dtf-game-portfolio-upgrade`, `dtf-education-production`, `dtf-content-preservation`, `dtf-web-quality-gate`, `dtfseeds-production-repair`, or `dtfseeds-production-publishing`.

Read and obey:
1. `AGENTS.md`
2. `data/project-registry.json`
3. `data/site-registry.json`
4. `engineering/system-map.json`
5. `engineering/ownership.json`
6. `engineering/dependency-graph.json`
7. `engineering/invariants/core.json`
8. `engineering/issue-patterns/registry.json`
9. canonical subsystem source-of-truth docs
10. the current implementation/tests/CI/deployment/live evidence

## Required lifecycle

```text
observe
→ classify domain
→ classify recurrence
→ classify maturity
→ classify change risk
→ resolve canonical ownership
→ inspect repair memory and history
→ reproduce
→ trace end-to-end throughput
→ isolate earliest failing boundary
→ research authoritative solution when required
→ identify symptom / immediate cause / root cause / systemic gap
→ assess blast radius
→ choose highest appropriate durable repair layer
→ route implementation to specialist skill
→ add regression guard
→ execute deterministic verification
→ integrate on the owning branch/PR
→ deploy when applicable
→ verify live production behavior
→ update repair memory
```

## Domains

Classify into one or more:
- `GAME_RUNTIME`
- `GAME_VISUAL`
- `CONTENT_EDUCATION`
- `WEBSITE`
- `ASSET_PIPELINE`
- `INFRASTRUCTURE`
- `REPOSITORY`
- `SECURITY`

Use `engineering/ownership.json` to route execution.

## Recurrence

- `R0` first occurrence
- `R1` similar historical occurrence
- `R2` repeated exact/near-exact failure
- `R3` repeated across components
- `R4` repeated across repositories
- `R5` systemic architecture/workflow failure

At `R2+`, require root-cause analysis and a durable regression guard. At `R3+`, investigate shared invariants or abstractions. At `R4+`, prefer platform/shared repair where the invariant is truly common. At `R5`, perform architecture review.

## Confidence

- `C0` speculation
- `C1` evidence suggests
- `C2` reproduced
- `C3` first failing boundary/root cause isolated
- `C4` locally verified
- `C5` integration verified
- `C6` production verified
- `C7` recurrence prevention verified

Do not report `fixed` below the confidence required by the requested outcome.

## Maturity

- `M0` idea
- `M1` scaffold
- `M2` functional prototype
- `M3` complete core loop
- `M4` QA ready
- `M5` release candidate
- `M6` production
- `M7` measured/maintained

Prioritize missing core capability before polish at low maturity. Prioritize regression control, performance, accessibility, security and observability as maturity increases.

## Change risk

- `Q0` isolated copy/text
- `Q1` isolated style/asset
- `Q2` local component behavior
- `Q3` game mechanic/content schema/data model
- `Q4` shared package/API/asset loader/cross-feature state
- `Q5` auth/security/database/deployment/multiplayer protocol/cross-repository contract

Expand verification with risk. `Q4/Q5` require blast-radius and contract analysis. `Q5` requires staging/security/rollback/live verification where applicable.

## Research policy

Research is mandatory when recurrence is `R2+` and the root cause is not fully project-specific, or when framework/library/security/version behavior is uncertain.

Research order:
1. successful project precedent
2. official framework/library/runtime docs
3. standards/specifications
4. upstream source/issues/discussions
5. reputable engineering references
6. community evidence for edge cases

Record the installed/current version, authoritative finding, project constraints, chosen pattern, and rejected alternatives. Never blindly copy online patches.

## Throughput tracing

Map the complete applicable path and label every boundary `PASS`, `FAIL`, `UNVERIFIED`, `DUPLICATED`, `BYPASSED`, or `STALE`.

Game:
`input -> event -> state -> mechanic -> simulation -> render/audio -> persistence/multiplayer -> visible result`

Content:
`research -> source -> extraction -> structured content -> assessment -> media -> registry -> build -> page -> search -> certification`

Asset:
`source -> export -> optimization -> naming/version -> manifest -> repo -> build -> deployed URL -> runtime render`

Website:
`route -> navigation -> component -> content/data -> build -> deployment -> browser -> interaction`

Release:
`issue -> branch -> commit -> tests -> PR -> CI -> merge -> build -> artifact -> deployment -> live verification`

Always repair the earliest failing boundary that explains downstream symptoms.

## Root-cause record

Always distinguish:
- `SYMPTOM`
- `IMMEDIATE_CAUSE`
- `ROOT_CAUSE`
- `SYSTEMIC_GAP`

## Durable repair priority

Prefer, in order:
1. restore a violated invariant
2. repair the canonical shared implementation
3. strengthen producer/consumer contract
4. centralize genuinely duplicated logic
5. remove obsolete path
6. improve validation/state ownership/idempotency/error handling
7. improve observability
8. add deterministic regression protection

Do not solve recurrence with repeated branch creation, duplicate helpers, swallowed errors, disabled tests, hardcoded environments, manual uploads, unexplained retries, or cache clearing alone.

## Game-specific recurrence

When practical capture deterministic game evidence:
- version
- level
- RNG seed
- initial state
- ordered inputs
- ticks/timestamps
- final state/failure

Prefer seeded randomness, fixed simulation steps where appropriate, state snapshots, replay tests, and property/invariant tests for core mechanics.

## Verification authority

Agents may diagnose and implement. Deterministic checks are authoritative for lint, types, schemas, unit/property/contract tests, builds, asset checks, security scanning, browser tests, performance gates, deployment checks, and live smoke tests.

Never declare success when deterministic evidence contradicts it.

## Production and rollback

For production-impacting work, verify source-to-production identity:
`source -> build -> artifact -> deployment -> route -> browser/user-visible result`.

For `Q4/Q5`, document last known-good version, revertability, schema/save-data compatibility, asset versioning, feature-disable path when available, and roll-forward strategy if rollback is unsafe.

## Repair memory

Search `engineering/issue-patterns/registry.json` before external research. After solving a recurring issue, update the registry with signature, aliases, domains, repositories, symptoms, root cause, systemic gap, failed approaches, canonical repair, research, regression guards, related commits/PRs, recurrence count, and verification level.

## Required report

Report:
`Issue, Domain, Repository/Application, Recurrence, Maturity, Risk, Blast Radius, Confidence, Reproduction, First Failing Boundary, Root Cause, Systemic Gap, Research, Chosen Repair, Specialist Skill, Contracts, Regression Guards, Verification, Integration, Deployment, Production, Rollback, Repair-Memory Update, Remaining Risk, Next Maturity Action.`

Use `NOT RUN` or `UNVERIFIED` explicitly rather than inventing results.

## Definition of done

A recurring/systemic issue is complete only when applicable ownership, reproduction, throughput mapping, research, root-cause isolation, durable repair, regression guard, domain verification, integration, target-branch confirmation, production verification, rollback knowledge, repair-memory update, and cleanup are complete.
