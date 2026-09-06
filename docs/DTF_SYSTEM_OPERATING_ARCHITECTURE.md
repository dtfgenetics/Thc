# DTF System Operating Architecture

Status: proposed V2 control-plane architecture

This document defines how DTF Genetics automation should be structured so automated workers can safely discover, create, update, test, repair, integrate, deploy, verify, and maintain work across the DTFSeeds ecosystem.

It is intentionally broader than the GitHub worker scheduler. The scheduler is one subsystem inside the operating architecture.

## Research conclusion

DTF already has many of the correct building blocks: repository-wide agent instructions, Parallel Studio for isolated concurrent work, a GitHub repository-manager skill for repair and integration, project and site registries, project-specific source-of-truth documents, game architecture/release contracts, CI workflows for individual applications/content areas, production publishing and repair procedures, and live-route validation/deployment scripts.

The structural problem is that these are mostly independent capabilities. A worker can know how to edit a game, another workflow can know how to deploy it, and another script can know how to reconcile a branch, but no single durable controller owns the complete lifecycle from requested outcome to verified production result.

The target therefore is not one giant AI agent. The target is a layered control plane with deterministic state, specialized workers, explicit permissions, and evidence-based gates.

Current GitHub platform research supports this separation:

- GitHub Agentic Workflows provide contextual AI execution and support coding engines including OpenAI Codex.
- GitHub reusable workflows centralize deterministic repeatable automation.
- GitHub concurrency groups serialize conflicting shared resources.
- Repository rulesets can enforce pull requests, status checks, code-scanning results, force-push restrictions, and related merge policy.
- GitHub environments provide a separate protection boundary for staging and production deployments.

The DTF controller should use those primitives rather than implementing every concern as custom issue-label logic.

## Operating principles

### Deterministic control, agentic execution

AI workers may inspect, reason, implement, diagnose, and propose repairs. Deterministic code owns job identity, queue state, leases, resource ownership, permissions, branch creation, exact-head verification, required checks, integration decisions, environment access, deployment execution, rollback bookkeeping, and production verification records.

An AI agent must never be the only record of whether a job is running, complete, safe to merge, or deployed.

### One canonical owner per resource

Every product, route, dataset, deployment surface, and shared configuration must resolve to one canonical owner before work begins.

Resolution order:

1. `data/project-registry.json` for product/repository ownership.
2. `data/site-registry.json` and deployment registries for public routes.
3. subsystem source-of-truth documentation for local paths and implementation contracts.
4. an explicit resource registry for shared files and production targets.

The controller must refuse to create a competing implementation when the canonical source belongs in another repository.

### Parallel development, serialized conflicting writes

Different projects should run concurrently. Only jobs that overlap the same exclusive resource must serialize.

Examples include the same game source directory, project registry record, public route package, WordPress page, production deployment target, or shared navigation/release manifest when concurrent writes cannot be merged safely.

Existing Parallel Studio overlap/resource classification should feed this scheduler rather than being duplicated.

### No direct production authority for implementation workers

Code, content, game, audit, and repair workers produce verified candidates. They do not directly publish to production. Production is owned by a release controller operating through a protected environment and production-specific reusable workflows.

### Production success requires live evidence

The lifecycle does not end at commit, PR merge, build, artifact upload, or deployment command success. A production-changing job reaches `DONE` only after the exact visitor-facing route or service is verified against its release contract.

## System layers

The architecture is divided into nine layers.

### A. Intake and discovery

Sources of work include user requests, GitHub issues, failed workflow runs, security/dependency findings, scheduled repository audits, live-site audits, broken-link and route checks, visual regression results, game acceptance failures, stale branches/PRs, content freshness audits, registry gaps, deployment drift, and manual project goals.

Intake normalizes all work into a job record. Audits create repair jobs instead of editing unrelated systems in one branch.

### B. Planner

The planner converts a goal into one or more jobs and records project, repository, canonical source paths, requested outcome, acceptance criteria, dependencies, worker kind, required capabilities, resource claims, test profile, deployment impact, priority, and retry policy.

AI may help decompose work, but the resulting plan must be machine-readable and validated against registries.

### C. Scheduler and lease manager

The scheduler selects ready jobs based on dependency completion, priority, worker/repository/project capacity, resource conflicts, production-target conflicts, rate/cost limits, and retry backoff.

A claim is a renewable lease, not a permanent label.

Required lease fields:

```json
{
  "leaseId": "uuid",
  "workerId": "worker identity",
  "acquiredAt": "timestamp",
  "renewedAt": "timestamp",
  "expiresAt": "timestamp",
  "attempt": 1
}
```

Workers send heartbeats. Expired leases are reconciled. Unique branch work is preserved; it is never automatically discarded simply because the worker died.

### D. Worker router

Initial worker kinds:

- `planner` — decompose large goals and create structured work;
- `code` — implementation/refactoring;
- `test-repair` — diagnose and repair failing tests/CI;
- `game` — gameplay/UI/assets/runtime work using game contracts;
- `visual-qa` — route rendering, responsive and visual checks;
- `content` — structured educational/editorial data changes;
- `research` — authoritative-source research and evidence capture;
- `data` — registries, datasets, validation and reconciliation;
- `security` — dependency/code security remediation;
- `repo-maintenance` — branches, PRs, workflow failures and stale work;
- `release` — staging/production candidate coordination;
- `live-qa` — post-deployment visitor-facing verification.

Specialized worker instructions stay in `.agents/skills/`. The orchestrator chooses a skill; it should not duplicate each skill's detailed instructions into every job.

### E. Execution

Every implementation job executes in one isolated managed branch/worktree. The worker receives an immutable execution envelope containing job ID, issue number, repository, branch, base branch/SHA, project, worker kind, resource claims, acceptance profile, and attempt.

The worker updates the same branch repeatedly. Failure must not create `-v2`, `-v3`, `-final`, or replacement branches by default.

### F. Verification

Verification is selected by changed resources rather than one monolithic test.

Repository-control profiles validate syntax/config, branch policy, workflows, registries and secrets. Browser-app profiles run unit tests, type checks, builds, route/base-path validation, browser smoke, E2E, accessibility and console/network checks. Game profiles add deterministic rules tests, seeded simulations where useful, serializable state, input/viewport coverage, gameplay acceptance and asset/public-package checks. Education/content profiles add schema, source/citation, duplicate/slug, link, asset and navigation/render checks. Deployment profiles verify exact source SHA, environment gates, rollback preparation, deploy result, live identity/assets/browser behavior and critical interaction flows.

A check result is attached to the exact branch head SHA. Stale results cannot authorize integration.

### G. Repair loop

Failures are classified before retrying: transient infrastructure, dependency/install, compilation, unit test, E2E, visual regression, merge conflict, resource conflict, permission/credential, deployment transport, live verification, policy/security, or unknown.

Transient failures may retry automatically. Code/test failures route to a repair worker. Credential/policy failures block instead of retrying forever. The same branch is reused unless branch integrity is lost. Jobs exceeding `maxAttempts` move to quarantine/dead-letter state with evidence preserved.

### H. Integration and release

Integration controller requirements:

1. PR exists and targets the declared base.
2. PR head equals the recorded expected head.
3. canonical ownership remains valid.
4. no forbidden resource overlap exists.
5. required verification profile is green on the exact head.
6. repository rules allow merge.
7. merge result is recorded.

For production-impacting changes: merged commit becomes a release candidate, enters staging, staging verification runs, production controller acquires an exclusive production-target lease, backup/rollback data is recorded, production deploy runs, live verification runs, release record is updated, and only then is the job done.

### I. Reconciliation and observability

A scheduled reconciler compares declared state with real GitHub/runtime state. It detects claimed issues with missing branches, branches with missing claims, expired leases, worker branches with unique commits but no active worker, PRs closed without merge, merged PRs whose issues remain claimed, checks for old heads, deployments from unexpected SHAs, production drift, orphan branches, duplicate/superseding branches, project ownership changes, and workflow failures awaiting repair.

This reconciler is mandatory because automation must recover from partial failures between API calls.

## Canonical job state machine

```text
DISCOVERED
  -> PLANNED
  -> READY
  -> LEASED
  -> RUNNING
  -> VERIFYING
  -> PR_OPEN
  -> INTEGRATION_READY
  -> MERGED
  -> STAGING
  -> PRODUCTION_READY
  -> DEPLOYING
  -> LIVE_VERIFYING
  -> DONE
```

Exceptional states:

```text
BLOCKED
RETRY_WAIT
REPAIRING
CONFLICTED
LEASE_EXPIRED
QUARANTINED
CANCELLED
SUPERSEDED
```

State transitions are validated. A production-impacting worker cannot jump from `RUNNING` directly to `DONE`.

## Job persistence

Issue labels are operator UI, not the only database. V2 should use issue/PR labels for visible state, a structured marker or job object for metadata, GitHub API state for branch/PR/workflow truth, an append-only event journal for transitions, and artifacts/check summaries for evidence.

A future external queue/database may replace the job-object layer if scale requires it, but V2 should remain GitHub-native until demonstrated otherwise.

Suggested structure:

```text
.github/workflows/
  orchestrator.yml
  worker-code.yml
  worker-game.yml
  worker-content.yml
  worker-repair.yml
  verify-change.yml
  integrate-candidate.yml
  deploy-staging.yml
  deploy-production.yml

scripts/orchestrator/
  core.mjs
  github.mjs
  state.mjs
  leases.mjs
  planner.mjs
  scheduler.mjs
  resources.mjs
  checks.mjs
  reconcile.mjs
  integration.mjs
  release.mjs

configuration/orchestrator/
  workers.json
  resources.json
  verification-profiles.json
  retry-policies.json
  repositories.json
```

Mutable runtime state should normally live in GitHub issues/checks/workflow runs rather than being constantly committed to `main`.

## Multi-repository control

`dtfgenetics/Thc` is the integration/control repository, but many canonical products live elsewhere. The orchestrator needs a repository adapter and may not assume every job should create a branch in `Thc`.

`data/project-registry.json` already provides ownership mapping. A cross-repository change should normally follow:

```text
canonical repo implementation
  -> canonical repo PR/verification
  -> merge
  -> integration snapshot/update job in Thc
  -> Thc integration PR/verification
  -> production release
```

This prevents integration snapshots from becoming competing source trees.

## Project classes

### Website/platform
Own shared navigation, public-route packaging, WordPress adapters, integration registries, global styling and deployment.

### Games
Each game has an owner, game-specific acceptance profile and release contract. Shared game tooling belongs to platform/game infrastructure rather than individual games.

### Education
Canonical educational platform/content remains separated from website packaging. Content generation, scientific review, schema validation, media production and web publishing are separate jobs/gates.

### Grow Doc / diagnostics
Diagnostic model/data work belongs in its canonical repository. Web integration is downstream. Dataset validation and application testing are independent gates.

### Plant Atlas / GrowLens
Treat data/model, 3D assets, runtime and live-route packaging as distinct resource groups so visual work does not accidentally modify diagnostic/platform logic.

### Media/infographics
Asset production requires provenance, approved master, format/resolution checks, metadata, topical ownership and publication placement. Generating an image is not publishing it.

### Business/private systems
Private or regulated business information must not be moved into public repositories for orchestration convenience. Support a `manual/external` adapter for intentionally external systems.

## GitHub platform enforcement

The repository should progressively adopt GitHub-enforced protections rather than relying only on worker instructions. Target `main` policy: require PRs, require current status checks, block force pushes, prevent branch deletion, require configured security/code gates, minimize bypass actors, and ensure automation cannot silently bypass policy.

Roll rules out only after identifying exact required check names so current deployment/maintenance flows are not accidentally locked out.

## Reusable workflows versus agentic workflows

Use reusable deterministic workflows for checkout/setup, dependency install, validation, builds, tests, artifact handling, deployment, production smoke tests and integration checks.

Use agentic/Codex workflows for implementation, issue decomposition, failure diagnosis, repair patches, audit interpretation and documentation/content improvements where policy allows.

Agentic workflows call or trigger approved deterministic validation rather than inventing their own definition of success.

## Security model

Implementation workers get least privilege: repository metadata/content access and approved managed-branch/PR/issue outputs, with no production secrets. Release workers cannot modify arbitrary code and receive deployment access only after environment gates; they deploy immutable verified candidates.

Security requirements include pinning third-party actions to immutable SHAs where practical, explicit workflow permissions, environment-scoped secrets, short-lived/OIDC credentials where supported, no production secrets in AI prompts/untrusted code, and validation of untrusted PR content before privileged stages.

## Observability

Minimum metrics: ready jobs, running workers, utilization by kind, stale/expired leases, retries, failure classes, time-to-green PR, PRs awaiting integration, blocked/quarantined jobs, deployment candidates, staging status, production verification failures, jobs completed per project, and orphan branch/PR count.

Every job exposes a timeline of transitions and evidence links.

## Definition of V2 ready

The control plane is V2-ready when it can demonstrate these against test issues without manual state editing:

1. create a structured job;
2. update requirements/priority safely;
3. resolve canonical project/repository ownership;
4. plan dependencies/resource claims;
5. lease to an eligible worker;
6. create one isolated branch;
7. start and heartbeat the worker;
8. preserve/recover work after interruption;
9. run the correct verification profile;
10. route failures to retry/repair/block policy;
11. open/update one PR for the job;
12. verify exact PR head and required checks;
13. integrate without bypassing policy;
14. release production-impacting work through staging/production gates;
15. verify the exact live result;
16. mark done only after acceptance criteria pass;
17. reconcile partial failures/orphans automatically;
18. produce an operator status report at any time.

## Implementation sequence

### Phase 1 — durable orchestrator V2
Implement state machine, leases, heartbeat, create/update/check/reconcile/retry/block/complete commands, job metadata validation and recovery tests.

### Phase 2 — verification router
Create verification profiles and map repository paths/projects to correct tests/builds/audits. Reuse existing scripts rather than replacing them.

### Phase 3 — execution adapters
Connect specialized workers, beginning with code, repo-maintenance, game and test-repair. Add Agentic Workflow/Codex integration where repository/account configuration supports it.

### Phase 4 — multi-repository adapter
Use `data/project-registry.json` to route work to canonical repositories and create downstream integration jobs in `Thc` when needed.

### Phase 5 — protected integration
Audit current checks, introduce a repository ruleset for `main`, then make orchestrator integration depend on GitHub-enforced policy.

### Phase 6 — release controller
Normalize staging and production environments, exclusive production-target locks, immutable release candidates, backup/rollback records and live verification.

### Phase 7 — autonomous audits and continuous improvement
Schedule bounded audits that create prioritized repair jobs for broken CI, stale production, route regressions, visual issues, outdated content and repository hygiene. Audits create work; they never bypass implementation/release lifecycle.

## Immediate engineering work

Upgrade `scripts/orchestrator.mjs` first. Required commands:

```text
create
update
plan
dispatch
start
heartbeat
check
complete
fail
retry
block
release
reconcile
status
```

`claimTtlMinutes` must become an enforced lease setting rather than unused configuration. Scheduled orchestration should reconcile before dispatch so stale state cannot consume capacity indefinitely.

After V2 lifecycle behavior is tested, build the verification router. Only after those deterministic controls exist should implementation agents receive automated execution.

## External research references

- GitHub Agentic Workflows: https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows
- Creating GitHub Agentic Workflows: https://docs.github.com/en/copilot/how-tos/github-agentic-workflows/creating-github-agentic-workflows
- Reusable workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations
- Actions concurrency: https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency
- Ruleset rules: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Deployment environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments

These platform features are implementation tools. DTF-specific ownership, release, safety and production-verification contracts remain authoritative for DTF behavior.
