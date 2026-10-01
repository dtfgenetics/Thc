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
- `maxWorkersPerProject: 1` for legacy/unscoped jobs
- `maxScopedWorkersPerProject: 3` for jobs with non-empty resource claims

The repository may have up to four active orchestrated tasks overall. Legacy/unscoped work keeps its project lane exclusive. Resource-scoped jobs may share the same project lane when their resources do not overlap, up to the scoped project limit. For example, `game.high-iq` and `game.high-land` may run together under `project:games`, while two `game.high-iq` jobs cannot.

## Commands

```bash
node scripts/orchestrator.mjs labels
node scripts/orchestrator-plan-job.mjs --issue=123 --project=tools --worker-kind=code --resources='tool.vpd' --acceptance='tests pass'
node scripts/orchestrator-epic.mjs --manifest=configuration/orchestrator/example-epic-manifest.json
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


## Scoped same-project concurrency

Project labels are an organizational lane, not the final locking primitive.

Scheduling rules:

1. Resource overlap always blocks concurrent dispatch.
2. A legacy/unscoped active job keeps its entire project lane exclusive.
3. A new unscoped job will not start while any active/planned job already occupies that project lane.
4. Scoped jobs with disjoint resources may run together in the same project up to `maxScopedWorkersPerProject`.
5. The repository-wide `maxWorkers` limit still applies.

This lets multiple chats work on different games, tools, or applications at the same time without relaxing safety for older jobs that have not yet been migrated to explicit resource claims.


## Executor attachment protocol

Dispatch reserves a job; it does not pretend the scheduler itself is the implementation agent.

A real chat/agent attaches through `scripts/orchestrator-executor.mjs`:

```bash
node scripts/orchestrator-executor.mjs packet --issue=123
node scripts/orchestrator-executor.mjs claim --issue=123 --executor-id=chat:abc --provider=chatgpt --session-id=session-1
node scripts/orchestrator-executor.mjs heartbeat --issue=123 --executor-id=chat:abc --lease-id=<lease> --progress=editing --head-sha=<sha>
node scripts/orchestrator-executor.mjs handoff --issue=123 --executor-id=chat:abc --lease-id=<lease> --completed='item one|item two' --remaining='verification'
node scripts/orchestrator-executor.mjs result --issue=123 --executor-id=chat:abc --lease-id=<lease> --outcome=ready-for-verification --head-sha=<sha> --pr=77 --evidence='npm test|npm run build'
```

The read-only `packet` command returns the complete execution contract: repository, branch/base, resource scope, allowed paths, dependencies, acceptance criteria, verification profile, production targets, and worker capabilities.

`claim` transfers the dispatcher lease to the actual executor and moves the job from `LEASED` to `RUNNING`. Heartbeats renew the same lease and persist progress/head state.

`handoff` persists completed work, remaining work, blockers, and last head SHA so another chat can resume without the previous transcript.

`result --outcome=ready-for-verification` moves the job to `VERIFYING` and records the expected head/PR. `result --outcome=failed` moves it to bounded retry handling.

The durable audit flags active jobs with no executor, executor/lease ownership mismatches, and stale executor heartbeats.


## Cross-repository canonical routing

The `Thc` repository is the control plane, not the canonical implementation home for every DTF product.

A planned job may declare:

```html
<!-- worker-plan:{"canonicalDomain":"cultivation tools","resourceSet":["tool.vpd"],"allowedPaths":["src/tools/vpd/**"],"verificationProfile":"tools-canonical"} -->
```

The controller resolves `canonicalDomain` through `data/repository-registry.json`.

Examples:

- cultivation tools -> `dtfgenetics/Tools`
- THC encyclopedia/general cultivation education -> `dtfgenetics/thc-grow-hub`
- certification courses -> `dtfgenetics/Thc-learning-courses-`
- Grow Doc application -> `dtfgenetics/Thc-dataset`

For external canonical repositories:

1. the central GitHub issue remains the durable job ledger;
2. dispatch records the target repository and managed branch but does not create that branch in `Thc`;
3. external jobs require explicit `resourceSet`, `allowedPaths`, and `verificationProfile`;
4. an authorized executor runs `orchestrator-executor.mjs provision` to create the managed branch in the canonical repo and record its base SHA;
5. only after provisioning may the executor claim and start the job;
6. reconciliation, PR discovery, changed-file scope checks, and exact-head verification inspect the canonical target repo;
7. the durable lifecycle state remains in the central `Thc` issue.

This prevents integration mirrors or migration repositories from silently becoming a second source of truth.


## Validated job planner

New multi-chat work should not hand-edit the machine-readable `worker-plan` marker.

Use `scripts/orchestrator-plan-job.mjs` against an open Agent Job issue. The planner:

- requires one bounded project lane;
- validates the worker kind;
- requires at least one explicit resource and acceptance criterion;
- resolves canonical ownership through the repository registry;
- resolves local resource paths/production targets or enforces explicit scope for external canonical repos;
- validates verification routing;
- replaces stale `project:*`, `priority:*`, and worker-kind labels during re-planning;
- refuses to re-plan claimed/running/verifying/integration-ready/done jobs;
- remains dry-run unless `--apply=true`;
- adds `worker:ready` only when `--ready=true` is explicitly supplied.

Example local job:

```bash
node scripts/orchestrator-plan-job.mjs \
  --issue=123 \
  --project=games \
  --worker-kind=game \
  --resources='game.high-iq' \
  --acceptance='mobile layout passes|gameplay tests pass' \
  --priority=p1 \
  --apply=true \
  --ready=true
```

Example external canonical Tools job:

```bash
node scripts/orchestrator-plan-job.mjs \
  --issue=124 \
  --project=tools \
  --worker-kind=code \
  --canonical-domain='cultivation tools' \
  --resources='tool.vpd' \
  --allowed-paths='src/tools/vpd/**' \
  --verification-profile='tools-canonical' \
  --acceptance='tool tests pass|mobile result layout remains usable' \
  --apply=true \
  --ready=true
```

Planning and dispatch are intentionally separate. A chat may validate/store a plan without making it immediately dispatchable.


## Epic work graphs

Broad requests should become an Epic plus bounded Agent Jobs rather than one oversized worker branch.

Epic manifests use `configuration/orchestrator/epic-manifest.schema.json`. A complete example is stored at `configuration/orchestrator/example-epic-manifest.json`.

Dry-run a manifest:

```bash
node scripts/orchestrator-epic.mjs \
  --manifest=configuration/orchestrator/example-epic-manifest.json
```

Create the Epic and child jobs after the entire graph validates:

```bash
node scripts/orchestrator-epic.mjs \
  --manifest=path/to/project-epic.json \
  --apply=true \
  --ready=true
```

The graph validator requires unique job keys, resource scope, acceptance criteria, valid dependency references, and an acyclic dependency graph. Every child job is also passed through the normal canonical-repository/resource routing logic before any issue is created.

On apply:

1. one durable `[EPIC]` issue is created in the control repository;
2. child jobs are created in topological order;
3. manifest dependency keys are replaced with actual `issue-N` dependencies;
4. each child stores its validated `worker-plan` marker;
5. the Epic is updated with a checklist of child issue numbers;
6. `--ready=true` makes valid child jobs immediately eligible for the normal dependency-aware dispatcher.

Independent child jobs can be claimed by different chats concurrently. Dependent jobs remain blocked until their prerequisite job issues reach `DONE`.

The controller never deletes partially created work after an infrastructure/API failure. Any created Epic/job issues remain durable evidence for reconciliation and repair.
