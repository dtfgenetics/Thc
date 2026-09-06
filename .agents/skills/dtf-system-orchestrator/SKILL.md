---
name: dtf-system-orchestrator
description: Operate the DTF Genetics system as a coordinated control plane across repositories, projects, games, education, Grow Doc, GrowLens/Plant Atlas, content, assets, CI, deployments, and live verification. Use when work spans multiple DTF subsystems, when the user asks to create/update/check/fix/finish everything needed, when work must be routed to the correct canonical repository, or when jobs need planning, worker assignment, verification, repair, integration, deployment, and recovery as one lifecycle.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with GitHub/repository access. Use repository-specific skills and current authoritative platform documentation for subsystem execution.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF System Orchestrator

Use this skill as the system-control layer for the DTF Genetics / DTFSeeds ecosystem.

The user should be able to say things such as **continue the project**, **fix everything needed**, **create and update the system**, **check all the work**, **move every project forward**, **repair failed work**, **finish the games**, **fix education**, **push what is ready**, or **make the whole system production-ready** without manually identifying every repository, worker, branch, test, workflow, or deployment step.

The goal is not one giant agent making unrelated edits. The goal is to move requested outcomes through a durable, observable lifecycle using the correct canonical owner, specialized worker, isolated branch, verification profile, repair loop, integration gate, deployment owner, and live acceptance evidence.

## Authority order

Before acting, resolve instructions in this order:

1. repository `AGENTS.md` and repository-wide safety rules;
2. canonical project/repository ownership in `data/project-registry.json`;
3. public route/deployment ownership in `data/site-registry.json` and deployment registries;
4. `docs/DTF_SYSTEM_OPERATING_ARCHITECTURE.md`;
5. this skill;
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
6. Choose the correct worker kind.
7. Create or resume one managed branch for the job.
8. Record a renewable lease/ownership state for active work.
9. Execute only within the declared job scope.
10. Run the verification profile required by the changed resources.
11. Classify failures and repair on the same branch when safe.
12. Retry only according to bounded retry policy.
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

AI workers may reason, code, research, audit, diagnose, and propose repairs. Deterministic controls must own state transitions, leases, branch identity, exact-head checks, required verification, integration decisions, production environment access, release bookkeeping, and final live-success state.

## Canonical job lifecycle

Use the V2 state model:

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

Do not skip required states for convenience. Production-impacting work cannot move directly from implementation to `DONE`.

## Job record

A durable job should be able to represent at least:

```text
jobId
issueId
project
repository
canonicalPaths
publicRoutes
workerId
workerKind
branch
baseBranch
baseSha
resourceSet
verificationProfile
leaseId
leaseAcquiredAt
leaseRenewedAt
leaseExpiresAt
attempt
maxAttempts
state
workflowRunId
prNumber
expectedHeadSha
lastFailure
retryPolicy
acceptanceCriteria
productionImpact
releaseCandidateSha
liveVerificationEvidence
```

Labels are operator UI. They are not sufficient as the only source of job truth.

## Worker routing

Read `configuration/orchestrator/workers.json` for the machine-readable capability model.

Initial worker kinds:

- `planner` — inspect, research, decompose, create jobs;
- `code` — implementation, refactoring, tests, PR creation;
- `test-repair` — failing tests/builds/CI diagnosis and repair;
- `game` — gameplay, game UI/runtime/assets under game standards;
- `visual-qa` — rendering, responsive behavior, browser/console evidence;
- `content` — education/editorial/structured content changes;
- `research` — authoritative-source research and evidence capture;
- `data` — schemas, registries, datasets, reconciliation;
- `security` — dependency/code security review and remediation;
- `repo-maintenance` — branch/PR/workflow repair and repository hygiene;
- `release` — deterministic staging/production coordination;
- `live-qa` — post-deployment route and critical-flow verification.

Implementation workers do not receive production credentials or direct production authority.

## Create versus update behavior

Before creating anything, inspect whether the intended project/job/branch/PR already exists.

Create when:

- no canonical implementation/job exists;
- the new work is semantically independent;
- ownership resolution confirms the target repository/path;
- no in-flight branch should be resumed.

Update/resume when:

- an active job already owns the same requested outcome;
- a managed branch contains the current work;
- a PR already represents the job;
- a failure should be repaired on the same branch;
- requirements or acceptance criteria changed without invalidating the job identity.

Never default to `-v2`, `-v3`, `-new`, `-final`, or replacement branches after a normal failure.

## Leases and heartbeats

A claim is a renewable lease, not permanent ownership.

Required behavior:

- generate a unique lease ID;
- record worker identity and attempt;
- record acquired, renewed, and expiry timestamps;
- reject heartbeats from the wrong lease/worker;
- expire stale leases after the configured TTL/grace period;
- reconcile the actual branch and PR before requeueing;
- preserve unique commits and open PRs;
- safely requeue only when work can be resumed without loss;
- quarantine/block ambiguous ownership rather than deleting work.

The current V1 `claimTtlMinutes` setting must be treated as policy only until V2 code enforces it.

## Resource ownership and concurrency

Parallel development is the default. Serialize only conflicting writes.

Potential exclusive resources include:

- one canonical project source tree;
- one WordPress page/post or mutable route owner;
- project/site/public navigation registries;
- public game release manifests;
- shared deployment manifests;
- the same production destination;
- production WordPress publishing;
- staging/production release environment;
- a shared canonical dataset record when merge-safe parallelism is unavailable.

Use Parallel Studio overlap/resource classification when available instead of creating a second inconsistent overlap system.

## Verification routing

Read `configuration/orchestrator/verification-profiles.json`.

Choose verification from changed resources and project acceptance requirements. Never treat one green test as universal success.

Examples:

- repository-control changes: syntax, orchestrator tests, registries/navigation;
- general games: unified game preflight;
- High Land: unit/security, build, E2E, game preflight, then live route when released;
- GrowLens/Plant Atlas: GrowLens test/build/atlas/E2E verification;
- High IQ: data/runtime validation and game preflight;
- public release: navigation + release integrity + live identity verification;
- content/data: portfolio/schema/navigation checks plus subsystem checks.

Attach a passing verification result to the exact branch/head SHA. A result for an older commit cannot authorize integration.

## Failure classification and retry

Read `configuration/orchestrator/retry-policies.json`.

Classify failures before retrying:

- transient infrastructure;
- dependency/install;
- syntax/compile/type/build;
- unit/integration/E2E;
- visual/browser regression;
- merge conflict;
- shared-resource conflict;
- credential/policy/permission;
- deployment transport/environment;
- live verification;
- security/policy;
- unknown.

Rules:

- transient failures may retry automatically within policy;
- test/build/code failures route to a repair worker;
- merge conflicts route to repo-maintenance and preserve the branch;
- credential/policy failures block immediately rather than looping;
- deployment/live failures preserve the release candidate and rollback data;
- jobs exceeding maximum attempts move to quarantine/dead-letter state with evidence.

Do not hide repeated failures by creating replacement branches.

## Repository and multi-repository routing

`dtfgenetics/Thc` is the integration/control repository, not the canonical source for every DTF project.

Resolve ownership through `data/project-registry.json` before editing.

Typical multi-repository lifecycle:

```text
canonical product repo
  -> managed implementation branch
  -> product PR + verification
  -> merge product repo
  -> downstream DTFSeeds integration job
  -> integration branch/PR in dtfgenetics/Thc
  -> release verification
  -> deployment
  -> live verification
```

Do not edit an integration snapshot as a substitute for repairing canonical source.

## GitHub/repository operations

Delegate Git/GitHub mechanics to `.agents/skills/github-repo-manager/SKILL.md` and repository-specific controls.

The system orchestrator determines *what job should exist and where it belongs*. The repository manager determines *how to safely branch, sync, repair CI, open/update PRs, integrate, and recover Git/GitHub state*.

For new concurrent work in `dtfgenetics/Thc`, use Parallel Studio rules. Never silently reuse a task-name-matching branch.

## Game work

For any game:

1. resolve canonical repository and game owner;
2. read game-specific source-of-truth and skill;
3. use game architecture/release standards;
4. preserve deterministic/serializable rules where practical;
5. run game-specific tests and unified preflight as required;
6. route visual QA separately when visual readiness matters;
7. do not call a packaged build live until the exact production route is checked.

Game development, art production, audio, browser QA, deployment, and live multiplayer verification can be separate jobs under one parent outcome.

## Education/content work

Treat content generation, scientific/source review, schema validation, asset generation, placement, web publishing, and live route verification as distinct gates.

Canonical education work must remain in its canonical repository/data source. DTFSeeds packaging is downstream integration.

Do not treat generated text or an infographic file as published/approved simply because it exists.

## Grow Doc / diagnostic work

Resolve canonical diagnostic app/data ownership before editing. Dataset/model changes, app behavior, UI/UX, integration packaging, and live-site release are distinct resources and verification profiles.

Do not let platform integration copies become an alternate diagnostic source of truth.

## GrowLens / Plant Atlas

Separate:

- plant/science data;
- 3D/model assets;
- runtime/application code;
- UI/visual presentation;
- release package;
- live route verification.

This allows parallel visual/model work while preventing accidental edits to shared platform or diagnostic logic.

## Production and release

Implementation success is not production success.

When production behavior changes:

1. identify immutable verified candidate SHA/artifact;
2. acquire the release/production resource lock;
3. prepare backup/rollback record;
4. deploy through the owning deterministic workflow/environment;
5. verify deployment identity/source;
6. run live route/service checks;
7. run critical interaction flow where applicable;
8. record evidence;
9. mark `DONE` only when the release contract passes.

Use `.agents/skills/dtfseeds-production-publishing/SKILL.md` for dtfseeds.com publication.

## Reconciliation

Run reconciliation before dispatch and on a schedule.

Detect at minimum:

- claimed/leased job with missing branch;
- managed branch with missing job;
- expired lease;
- unique commits with no active worker;
- branch exists but claim update failed;
- closed-unmerged PR;
- merged PR with stale job state;
- required checks attached to an old head;
- branch/PR supersession candidates;
- canonical ownership changed while work was active;
- deployment from unexpected SHA;
- production route drift;
- workflow failure awaiting repair;
- orphan managed branches.

Never delete unique work merely to make reconciliation green.

## Operator status

At any time, the system should be able to report:

- queued/ready jobs;
- active leases and age;
- worker utilization by kind;
- blocked/retrying/quarantined jobs;
- active branches/PRs;
- stale leases and orphan work;
- failing checks by class;
- integration-ready PRs;
- staging/production candidates;
- live verification failures;
- completed outcomes by project;
- branch/PR cleanup candidates;
- capacity and shared-resource bottlenecks.

## Current V2 implementation target

The architecture/configuration are not proof that V2 runtime exists. Verify implementation before claiming readiness.

`node scripts/orchestrator.mjs` should ultimately support:

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
labels
```

Required V2 capabilities:

- versioned job metadata;
- validated state transitions;
- leases and heartbeat;
- stale recovery;
- retry attempts/backoff;
- dead-letter/quarantine;
- create/update semantics;
- exact-head verification;
- verification routing;
- resource conflict checks;
- multi-repository ownership routing;
- idempotent partial-failure recovery;
- operator status/evidence output.

Do not claim the skill can perform a command that the underlying orchestrator has not implemented yet. Use the available repository/GitHub tools directly while V2 is being completed, and continue building the missing runtime.

## Definition of system-ready

The DTF system is ready only when it can demonstrate, without manual state manipulation:

1. discover or create structured work;
2. safely update existing work;
3. resolve canonical ownership;
4. route to the correct repository/worker;
5. isolate the branch;
6. lease and heartbeat ownership;
7. execute and preserve work;
8. run exact required verification;
9. automatically repair/retry bounded failures;
10. block genuine credential/policy issues;
11. open/update one PR;
12. verify exact-head checks;
13. integrate safely;
14. produce downstream integration jobs for external canonical repos;
15. stage/deploy immutable candidates;
16. verify visitor/runtime state;
17. reconcile partial failures automatically;
18. expose reliable status and evidence.

Until all of these are implemented and tested, report the system as partially implemented rather than production-ready.

## Research escalation

Use current authoritative research when:

- GitHub Actions/rulesets/agentic-workflow behavior may have changed;
- a platform or engine integration is unfamiliar/version-sensitive;
- security or deployment behavior is involved;
- the first evidence-based repair fails;
- new execution tools (Codex, Blender, Unity, Unreal, audio/image/video systems) are being integrated into workers.

Research should change or validate implementation decisions. Do not perform research only to restate existing architecture.
