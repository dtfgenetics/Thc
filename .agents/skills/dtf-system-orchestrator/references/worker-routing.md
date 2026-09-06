# Worker Routing and Resource Ownership

Use this reference to select the correct worker and prevent parallel agents from creating competing implementations or overwriting shared/live resources.

## Resolve ownership first

Before worker assignment:

1. Read `data/project-registry.json` for canonical product/repository ownership.
2. Read `data/site-registry.json` for public route/deployment ownership.
3. Read subsystem source-of-truth documentation for local paths and release contracts.
4. Inspect current branches/PRs/workflows touching the same resource.
5. If ownership is ambiguous, create a planning/reconciliation job or block. Do not guess by editing the integration copy.

## Worker selection

The authoritative capability limits are in `configuration/orchestrator/workers.json`.

### planner
Use for broad goals, decomposition, dependencies, acceptance criteria, ownership resolution, and creating bounded jobs. Planner does not implement unrelated jobs in one branch.

### code
Use for application/library implementation, refactoring, bug fixes, and code tests when no more-specific worker applies.

### test-repair
Use after a concrete build/test/CI failure has been reproduced or inspected. Repair the same branch/head lineage rather than creating `-v2`/`-v3` branches.

### game
Use for gameplay, game UI/runtime, game-specific data/assets, input/state/multiplayer behavior, and game acceptance work. Also read the relevant game skill/specification.

### visual-qa
Use for browser rendering, responsive layout, console/network inspection, accessibility/visual evidence, and visitor-facing UI acceptance. It verifies; it should not become the primary implementation owner unless explicitly routed to repair.

### content
Use for educational/editorial structured content, curricula, documentation-like product content, and content-data updates. Apply content-preservation rules when canonical records are involved.

### research
Use when current authoritative evidence is required before implementation, when the system is unfamiliar/version-sensitive, or when an audit needs evidence. Research should create/update bounded jobs rather than silently changing unrelated production code.

### data
Use for registries, datasets, schemas, validation, reconciliation, and machine-readable catalogs.

### security
Use for dependency/security findings, permission hardening, workflow security, code scanning remediation, and related verification. Security changes still use PR/check gates.

### repo-maintenance
Use for branch/PR/workflow lifecycle, stale work, conflicts, failed Actions, integration preflight, rules/policy repair, and reconciliation. Also use `.agents/skills/github-repo-manager/SKILL.md`.

### release
Only worker class allowed production deployment authority. It coordinates immutable release candidates, staging, protected environments, deployment, rollback, and production-target locking. It should not perform arbitrary product implementation.

### live-qa
Use after deployment to verify exact production routes/services, expected release identity, browser/runtime health, and critical visitor flows. Live QA has no production credentials.

## Routing precedence

When several workers could act, choose the most specific owner:

1. release/live-qa for release-state work;
2. security for security/policy remediation;
3. repo-maintenance for repository/CI/integration mechanics;
4. game for game implementation;
5. content/data for their canonical data surfaces;
6. test-repair for evidence-backed failures;
7. code for general implementation;
8. planner/research for decomposition or unresolved evidence.

A job may transition between workers while retaining the same job ID and branch when safe.

## Resource claims

Jobs declare resources before dispatch. Resources may be shared or exclusive.

Typical exclusive resources:

- same canonical source directory during conflicting edits;
- one project registry record;
- one public route package/manifest;
- one WordPress page or equivalent live content target;
- one production deployment target;
- shared navigation/release manifest when changes cannot merge safely;
- same game state/schema contract when simultaneous edits would conflict.

Typical shared resources:

- read-only repository inspection;
- research/documentation references;
- independent tests that do not mutate shared state;
- unrelated projects/routes.

Development should remain parallel by default. Serialize only actual conflicting writes or identical live targets.

## Multi-repository handoff

When canonical implementation belongs outside `dtfgenetics/Thc`:

```text
canonical repository job
 -> canonical repo branch/verification/PR
 -> canonical repo merge
 -> downstream integration/update job in dtfgenetics/Thc
 -> Thc verification/PR/merge
 -> release controller if production-impacting
 -> live QA
```

Do not treat an integration snapshot in `Thc` as the canonical source merely because it is easier to edit.

## Branch ownership

One implementation job should normally own one managed branch. Repairs resume that branch. A new branch is justified only when the original branch is irrecoverably corrupt, explicitly superseded, or a deliberately separate job is created.

Before assigning a worker, check for an existing active branch/PR for the job/project/resource. Duplicate active ownership is a reconciliation problem, not permission to start another branch.

## Production authority boundary

Implementation workers can produce candidates but cannot declare production success. The release worker owns deployment actions; live-qa owns post-deploy evidence. A job with production impact cannot be marked `DONE` solely from a merged PR or green build.
