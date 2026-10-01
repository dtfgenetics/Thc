# GitHub Worker Orchestrator

The worker orchestrator is the control plane for parallel GitHub work in `dtfgenetics/Thc`. It is deliberately separate from implementation workers: it decides **what may start**, creates a single-purpose branch, records ownership on the issue, and leaves integration to the existing Studio/PR gates.

## Goals

- Stop duplicate workers from creating competing branches for the same project.
- Cap total concurrent work and per-project concurrency.
- Prioritize urgent work deterministically.
- Make every claim visible and recoverable from the GitHub issue itself.
- Keep `main` protected by policy: workers do not push directly to `main` and do not auto-merge.
- Reuse the existing `scripts/studio/*` integration and branch-lifecycle system instead of replacing it.

## Queue contract

An open GitHub issue enters the queue when it has `worker:ready`.

Optional routing labels:

- `priority:p0` through `priority:p3` — lower number wins.
- `project:<name>` — concurrency lane; defaults to `general`.
- `worker:code` — implementation/fix work.
- `worker:audit` — audit/diagnostic work.
- `worker:content` — structured content work.
- `worker:release` — release/integration work.

State labels:

- `worker:ready` — eligible to be claimed.
- `worker:claimed` — branch/worker slot is reserved.
- `worker:blocked` — excluded from dispatch until the blocker is removed.
- `worker:done` — integrated/completed work; excluded from dispatch.

## Claim behavior

The scheduled workflow runs every 15 minutes. A claim is fail-closed:

1. Re-read the issue and confirm it is still open, ready, and unclaimed.
2. Create a deterministic single-purpose managed branch from the exact current `main` SHA.
3. Add `worker:claimed`.
4. Store a machine-readable claim marker in the issue body.
5. Comment the branch, project lane, worker kind, and base SHA.

The orchestrator never silently reuses an existing branch.

## Concurrency

`data/worker-orchestrator.json` currently sets:

- `maxWorkers: 4`
- `maxWorkersPerProject: 1`

That means the repository can have up to four active orchestrated tasks, but only one active worker in a project lane such as `games`, `education`, `atlas`, or `release`. Increase the per-project value only after overlap/resource locking is expanded enough to make same-project parallelism safe.

## Commands

```bash
node scripts/orchestrator.mjs labels
node scripts/orchestrator.mjs status
node scripts/orchestrator.mjs plan
node scripts/orchestrator.mjs dispatch
node scripts/orchestrator.mjs dispatch --apply=true
node scripts/orchestrator-audit.mjs
node scripts/orchestrator-audit.mjs --strict=true
node scripts/test-worker-orchestrator.mjs
```

`dispatch` is dry-run unless `--apply=true` is provided.

## Worker completion contract

A worker that receives a claim should:

1. Work only on the recorded claim branch.
2. Keep the task scope aligned with the issue and project lane.
3. Run the relevant repo validation/tests.
4. Push commits to the claim branch.
5. Open a PR to `main` referencing the issue.
6. Use `node scripts/studio.mjs integrate <pr>` for integration preflight.
7. Merge only when current-head checks and CI pass.
8. Mark the issue `worker:done` and close it only after integration is confirmed.

Production publication remains owned by the existing cumulative production gateway and live verification process.

## What this first version does not do

This control plane does **not** pretend GitHub Actions itself is an AI coding worker. It allocates and governs work safely. The next layer should connect the claimed issue/branch to one or more execution workers (Codex/agent runners, deterministic repair workers, content workers, release workers) and have them report heartbeat/result events back to the claim. Keeping scheduler and executor separate prevents one failed worker from corrupting repository-wide orchestration state.


## V2 planned-scope contract

New scoped jobs may include one machine-readable planning marker in the issue body:

```html
<!-- worker-plan:{"resourceSet":["game.high-iq"],"verificationProfile":"high-iq","dependencies":[],"acceptanceCriteria":["mobile UI remains usable"]} -->
```

The orchestrator resolves resource IDs through `data/studio-resources.json`. Known resources automatically contribute their allowed source paths and production targets. Explicit `allowedPaths` and `productionTargets` may extend the resolved scope when the planner has a justified cross-resource requirement.

Examples:

- `game.high-iq` resolves the canonical High IQ game/public-route paths and `route:/games/high-iq/`.
- `platform.site-shell` resolves the shared shell/navigation paths and `shared:site-shell`.
- `content.education` resolves the controlled education/content paths and `route:/learn/`.

Unknown resource IDs fail planning instead of silently becoming unscoped work.

Active and newly planned jobs with overlapping non-empty `resourceSet` values are not dispatched together. The existing per-project cap remains as a second conservative safety boundary.

At exact-head PR verification, jobs with non-empty `allowedPaths` are fail-closed when the PR changes a file outside the recorded scope. Legacy jobs with no allowed-path scope remain compatible until they are migrated to planned V2 scope.

The intended flow is:

```text
issue / planner marker
  -> resource registry resolution
  -> leased job resourceSet + allowedPaths + productionTargets
  -> implementation
  -> PR changed-file scope gate
  -> exact-head checks
  -> integration ready
```


## Dependency-aware dispatch

Planned jobs may declare dependencies using GitHub issue job identifiers such as `issue-123`, `#123`, or `123`.

A dependency is satisfied only when the dependency issue is an orchestrated job that has either:

- the configured `worker:done` label; or
- an orchestrator marker whose state is `DONE`.

Open, running, merged-but-not-live, malformed, missing, or non-job dependency issues do not satisfy the dependency. This is intentionally fail-closed so downstream work cannot race ahead of prerequisites.

`plan` and dry-run `dispatch` output report dependency blockers.

## Automatic verification routing

When `verificationProfile` is omitted, the controller derives it from the declared resource set using `configuration/orchestrator/verification-profiles.json`.

Routing prefers a profile whose name matches the resource suffix when available:

- `game.high-iq` -> `high-iq`
- `game.high-land` -> `high-land`
- `app.growlens` -> `growlens`

Otherwise routing falls back by resource family:

- `game.*` -> `games-general`
- education/content resources -> `content-data`
- release/site-shell/commerce resources -> `public-release`
- unclassified application/control work -> `repo-control`

If a multi-resource job resolves to more than one verification profile, planning refuses to guess. The planner must declare an explicit profile appropriate for the combined change.


## Durable work audit

`scripts/orchestrator-audit.mjs` gives operators and future chats a repository-derived view of active durable work. The scheduled orchestrator runs it in report-only mode.

It reports:

- open orchestrator jobs grouped by lifecycle state;
- active resource owners;
- managed worker/project branches;
- orphan managed branches that no longer have a durable job;
- active jobs whose recorded branch is missing;
- `PR_OPEN` / `INTEGRATION_READY` jobs without the expected open PR;
- recorded PR-number mismatches;
- expected-head SHA drift on open PRs;
- post-merge lifecycle states without a matching merged PR;
- terminal jobs that incorrectly retain a worker lease;
- malformed orchestrator markers.

Default audit mode always reports and exits successfully so a discovered orphan does not disable scheduling or hide other state. `--strict=true` exits non-zero when anomalies exist and is intended for explicit governance/cleanup gates.

The audit is deliberately read-only. Recovery remains a separate reconciliation operation so detection cannot accidentally delete or rewrite unique work.
