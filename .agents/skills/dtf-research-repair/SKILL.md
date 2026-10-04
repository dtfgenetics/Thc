---
name: dtf-research-repair
description: High-throughput DTF research, repair, integration and production-release controller. Use when the user asks to continue, audit and fix, finish, research and implement, or broadly advance DTF Genetics projects. Reconciles durable state, selects high-value executable work, delegates to canonical subsystem skills, prevents repeat-audit loops, and continues through exact-head verification and live proof.
compatibility: Designed for DTF Genetics repositories with GitHub access. Uses current repository registries and subsystem skills instead of embedding mutable ownership maps.
metadata:
  author: dtfgenetics
  version: "2.1.0"
---

# DTF Research Repair Controller

This is a thin control skill. Do not duplicate the detailed mechanics already owned by subsystem skills.

## Required startup

1. Read the current repository `AGENTS.md`.
2. Read `data/project-execution-registry.json`, `data/project-registry.json`, `data/repository-registry.json`, relevant deployment/site registries, and `data/game-registry-v2.json` for named games.
3. Refresh canonical ownership from those records. Never treat an ownership map copied into this skill as authority.
4. Read `../dtf-system-orchestrator/SKILL.md` and `../dtf-parallel-studio/SKILL.md`.
5. Load only the specialized skill/reference needed for selected work.
6. Reconcile durable jobs, active PRs, branches, recent workflow/deployment runs, release pins, and prior run state before creating new work.

## Objective

Maximize verified project progress per run, not findings or prose. A successful run consumes ready work and leaves durable evidence.

Use the lifecycle:

`reconcile -> discover/select -> research if uncertain -> implement -> test -> exact-head review -> integrate -> release -> live verify -> persist -> select next work`

Do not stop after discovery, a plan, one finding, one commit, one PR, one merge, or one deployment command while useful executable work remains.

## Work budget

Use `references/execution-budget.md`.

Default non-trivial run targets when actionable work exists:
- inspect at least 3 independent areas: CI/deployment/registry health, one rotating visitor journey, and source/test/content/data coverage;
- attempt at least 3 ready executable jobs or continue until no additional safe ready job fits the run;
- complete at least 1 substantive repair;
- after the first completion, immediately select the next highest-value unblocked action;
- reserve roughly 25% of remaining capacity for verification, integration, deployment and durable handoff.

Targets are throughput controls, not quotas. Never invent defects or unsafe edits to satisfy them.

## Selection and rotation

Represent candidate work as executable records. Prefer existing durable records over duplicate issues.

Score non-emergency ready work using:

`score = (severity * userImpact * confidence * readiness * stalenessBoost) / max(cost, 1)`

Production outage, security/privacy exposure, destructive data loss, corrupt release ownership, and broken core flows override ordinary scoring.

Persist and consult:
- `lastInspectedAt`
- `inspectionCount`
- `lastRepairAt`
- `lastLiveVerificationAt`
- `consecutiveNoopInspections`
- `nextEligibleInspectionAt`
- `nextExecutableAction`

Do not inspect the same project/route/issue a third consecutive time without new evidence or state change. Execute its next action or rotate.

## Research policy

Research only when cause, implementation, science, acceptance criteria, licensing, security, or competitor behavior is materially uncertain.

Prefer:
- official/maintainer documentation for software;
- primary/institutional sources for cultivation/science;
- relevant working competitors for UX patterns, without copying protected implementation or assets.

Record the decision-relevant evidence and what it supports. Do not spend the execution budget re-researching already settled facts unless evidence is stale or contradictory.

## Campaigns

Broad outcomes are campaigns with a dependency DAG, not recurring audits.

A campaign contains:
- outcome and completion criteria;
- epics/capabilities;
- bounded executable jobs;
- dependencies;
- canonical owner/resource;
- verification/release profile;
- current state and next executable action.

Examples: Encyclopedia Completion, Grow Doc Production Readiness, Tools Suite Quality, Game Portfolio Completion.

“Continue” resumes the campaign DAG from durable state. Use `assets/campaign.schema.json` as the portable campaign contract when the existing orchestrator ledger does not already provide a stricter representation.

## Execution

For each selected job:
1. Resolve current canonical owner.
2. Resume existing unique work when valid; otherwise create an isolated session branch.
3. Reproduce confirmed defects from current source/runtime evidence.
4. Implement in the canonical owner.
5. Add meaningful regression coverage.
6. Run affected deterministic checks/builds.
7. Classify failures as introduced, pre-existing, external/transient, stale verifier, or permission/policy.
8. Repair introduced/in-scope failures on the same branch.
9. Review the exact PR head using the repository PR-review skill.
10. Integrate only a validated exact head.
11. Follow protected release ownership.
12. Verify ordinary and cache-busted public behavior plus referenced resources and relevant user flow.
13. Prove expected revision/release fingerprint when available.
14. Persist evidence and select the next job.

Use bounded retries. Do not bypass red required gates, self-approve, or repeat an unchanged denied operation.

## Product-specific completion

Counts, static HTML, prototypes, uploads, commits, merges and successful workflow invocations are not product completion.

For education, keep the 420+ encyclopedia/general education separate from certification. Keep grading separate from student-selected answers.

For games, resolve the named game through v2 and evaluate its actual contract. Multiplayer requires real multi-client room/join/turn/reconnect/hidden-information/privacy behavior, not a static or single-client approximation.

## Durable issue record

Use the existing orchestrator ledger/job mechanism where available. A repair record must be able to preserve:
`issueId, campaignId, owner, resource, path, evidence, reproduction, priority, confidence, acceptanceCriteria, dependencies, branch, pr, headSha, tests, releaseState, liveState, lastInspectedAt, nextExecutableAction`.

## Deterministic validation

Before exact-head review or integration, run:

`node .agents/skills/dtf-research-repair/scripts/self-test.mjs`

The dedicated Research Repair Skill workflow must report this validation for pull-request changes to this controller. Do not treat documentation inspection as equivalent validation.

## Completion and reporting

Close only scoped milestones whose acceptance criteria pass.

Report deltas:
- substantive repairs completed;
- PR/commit/release links;
- newly confirmed issues;
- research that changed a decision;
- deterministic tests/builds;
- exact source/integration/deployment/live state;
- blockers and denied operations;
- next executable work.

At run handoff, persist structured events when the ledger supports them and use `scripts/summarize-run.mjs` to calculate throughput/repeat-audit metrics.

Never declare the portfolio complete because one repair shipped.
