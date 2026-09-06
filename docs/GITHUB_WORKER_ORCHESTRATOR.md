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
