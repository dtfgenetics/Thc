---
name: dtf-system-orchestrator
description: Operate the DTF Genetics system as a coordinated control plane across repositories, projects, games, education, Grow Doc, GrowLens/Plant Atlas, content, assets, CI, deployments, and live verification. Use when work spans multiple DTF subsystems, when the user asks to create/update/check/fix/finish everything needed, when work must be routed to the correct canonical repository, or when jobs need planning, worker assignment, verification, repair, integration, deployment, and recovery as one lifecycle.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with GitHub/repository access. Use repository-specific skills and current authoritative platform documentation for subsystem execution.
metadata:
  author: dtfgenetics
  version: "1.1.0"
---

# DTF System Orchestrator

Use this skill as the system-control layer for the DTF Genetics / DTFSeeds ecosystem.

The user should be able to say things such as **continue the project**, **fix everything needed**, **create and update the system**, **check all the work**, **move every project forward**, **repair failed work**, **finish the games**, **fix education**, **push what is ready**, or **make the whole system production-ready** without manually identifying every repository, worker, branch, test, workflow, or deployment step.

The goal is not one giant agent making unrelated edits. The goal is to move requested outcomes through a durable, observable lifecycle using the correct canonical owner, specialized worker, isolated branch, verification profile, repair loop, integration gate, deployment owner, and live acceptance evidence.

## Required references

Read these operational references when their concern is in scope:

- `references/job-lifecycle.md` — job schema, state machine, leases, transitions, idempotency, reconciliation, completion evidence.
- `references/worker-routing.md` — worker selection, resource claims, branch ownership, multi-repository handoffs, production authority.
- `references/verification-recovery.md` — exact-head verification, failure classification, repair/retry behavior, branch recovery, production verification.

The machine-readable policy remains under `configuration/orchestrator/`. The references explain how to apply it; do not create a conflicting second configuration inside the skill.

## Authority order

Before acting, resolve instructions in this order:

1. repository `AGENTS.md` and repository-wide safety rules;
2. canonical project/repository ownership in `data/project-registry.json`;
3. public route/deployment ownership in `data/site-registry.json` and deployment registries;
4. `docs/DTF_SYSTEM_OPERATING_ARCHITECTURE.md`;
5. this skill and its references;
6. `.agents/skills/github-repo-manager/SKILL.md` for Git/GitHub operations and repair;
7. `.agents/skills/dtf-parallel-studio/SKILL.md` for isolated concurrent work;
8. subsystem-specific skill and source-of-truth documentation;
9. `.agents/skills/dtfseeds-production-publishing/SKILL.md` for dtfseeds.com publication or live repair;
10. current code, data, tests, workflows, PRs, deployment state, and live evidence.

Never create a competing implementation merely because the integration repository contains a convenient copy. Route work to the canonical repository first.

## Core operating contract

For every non-trivial system task:

1. Discover the real current state.
2. Resolve canonical project, repository, source paths, public routes, and production targets.
3. Define the requested outcome and acceptance criteria.
4. Decompose broad goals into bounded jobs when necessary.
5. Identify dependencies and shared/exclusive resources.
6. Choose the correct worker kind from `configuration/orchestrator/workers.json`.
7. Create or resume one managed branch for the job.
8. Record a renewable lease/ownership state for active work.
9. Execute only within the declared job scope.
10. Run the verification profile required by the changed resources.
11. Classify failures and repair on the same branch when safe.
12. Retry only according to `configuration/orchestrator/retry-policies.json`.
13. Preserve unique work when a worker, workflow, or lease fails.
14. Open/update one PR for the job rather than spawning replacement branches.
15. Verify the exact PR head and all required checks before integration.
16. Merge through repository policy without bypassing safety gates.
17. For production-impacting work, continue through staging/deployment/live verification.
18. Mark work complete only when its acceptance criteria are actually satisfied.
19. Reconcile partial failures, orphan branches, stale leases, stale checks, and deployment drift.
20. Report evidence separately for repository success, deployment success, and live visitor-facing success.

A repairable failure is not a stopping point. Diagnose, repair, retest, and continue until the job passes or a genuine external blocker is proven.

## Control-plane model

Operate DTF as these coordinated layers:

```text
Intake / Discovery
  -> Planner
  -> Job Queue
  -> Scheduler
  -> Lease + Resource Manager
  -> Worker Router
  -> Execution Worker
  -> Verification Router
  -> Repair / Retry Controller
  -> PR / Integration Controller
  -> Staging / Release Controller
  -> Live QA
  -> Reconciliation / Observability
```

## Create versus update

Before creating work, search for an existing active job, issue, branch, or PR that owns the same requested outcome/resource.

- If a matching active job exists, update/resume it.
- If the work is a distinct bounded outcome, create a new job.
- If an earlier branch failed but contains unique work, recover that branch rather than replacing it.
- If ownership belongs to another canonical repository, create/continue the job there and use a downstream integration job in `Thc` only after canonical integration.

## Worker routing

Use `references/worker-routing.md` and `configuration/orchestrator/workers.json`. Worker kinds currently include planner, code, test-repair, game, visual-qa, content, research, data, security, repo-maintenance, release, and live-qa.

Implementation workers do not have production authority. Only the release controller may perform protected production deployment actions; live-qa independently verifies the visitor-facing result.

## Durable state and leases

Use `references/job-lifecycle.md`. A claim is a renewable lease with a unique lease ID, worker identity, acquired/renewed timestamps, expiry, and attempt. Heartbeats must match the active lease. Expiry does not authorize deletion of branch work.

Labels are operator UI, not sufficient durable truth. Reconcile labels/markers against actual GitHub branches, PRs, workflow runs, exact head SHAs, deployments, and live state.

## Verification and recovery

Use `references/verification-recovery.md` and `configuration/orchestrator/verification-profiles.json`.

Checks authorizing integration must match the exact current candidate head. After a code change, old green checks are stale. Failure must be classified before retrying. Repair should reuse the same branch. Missing credentials/policy should block instead of retrying forever. Exceeding the configured attempt limit quarantines the job with evidence preserved.

## Repository and branch mechanics

Use `.agents/skills/github-repo-manager/SKILL.md` for repository operations and `.agents/skills/dtf-parallel-studio/SKILL.md` for isolated concurrent work.

Never direct-push production merely because GitHub technically allows it. Never delete unique unmerged work as branch cleanup. Never spawn `-v2`, `-v3`, `-final`, or similar replacement branches as the normal repair strategy.

## Integration and production

A candidate is integration-ready only when canonical ownership remains valid, resource conflicts are clear, the PR targets the intended base, the expected head equals the actual PR head, and all required checks are green on that head.

Production-impacting work continues after merge. Follow staging/release policy, acquire exclusive production-target ownership, deploy the immutable candidate, then verify the exact public route/service. A merge, green build, uploaded artifact, or successful deployment command alone is not proof of production success.

## Reconciliation

Scheduled control-plane execution should reconcile before dispatch. Detect leases without branches, branches without jobs, expired leases, unique orphan work, closed-unmerged PRs, merged-but-still-running jobs, stale checks, failed workflows, unexpected deployment SHAs, production drift, duplicate/superseding branches, and ownership changes.

Reconciliation repairs control-plane state or creates bounded repair jobs. It must not destroy unique work to make the queue look clean.

## Definition of system completion

For a broad user request, do not equate "one job finished" with "the system is finished." Track every decomposed job and dependency. The requested outcome is complete only when all required jobs meet their acceptance criteria and any production-impacting jobs have live verification evidence.

If an external blocker remains, report the exact blocker, affected jobs, preserved work, evidence already passed, and the next executable action once the blocker is resolved.
