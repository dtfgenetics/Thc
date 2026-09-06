# Verification, Repair, and Recovery

This reference defines how the orchestrator decides whether work is correct and how it continues after failure without losing work or multiplying branches.

## Verification selection

Start with `configuration/orchestrator/verification-profiles.json`. Select profiles from canonical project ownership and changed resources. Do not use one generic green check as proof for every product.

Current profile examples include repository control, general games, High Land, GrowLens, High IQ, public release, and content/data. Extend profiles as projects gain deterministic acceptance commands.

## Exact-head rule

Every integration-authorizing verification result must belong to the exact current candidate head SHA. If the branch changes after checks pass, the prior result is stale and cannot authorize merge.

Record:

```json
{
  "profile": "repo-control",
  "headSha": "candidate sha",
  "startedAt": "timestamp",
  "completedAt": "timestamp",
  "status": "pass|fail|blocked",
  "evidence": []
}
```

## Verification order

Prefer fast/narrow checks before expensive checks, but all mandatory profile gates must pass before integration.

Typical sequence:

1. syntax/schema/static validation;
2. focused unit tests;
3. project build/type checks;
4. broader project/repository tests;
5. E2E/browser/runtime checks;
6. package/release integrity checks;
7. staging checks when production-impacting;
8. live verification after deployment.

## Failure handling loop

For every failure:

1. capture exact command/workflow/run/head;
2. inspect exact failing job/step/log or reproducible local output;
3. classify the failure;
4. decide retry vs repair vs block;
5. keep the same branch for repair when safe;
6. make a root-cause change;
7. run the narrowest proving check;
8. rerun required profile gates on the new exact head;
9. update failure/attempt evidence;
10. quarantine after policy limit rather than retry forever.

A failed check is not a reason to spawn a replacement branch.

## Failure routing

### Transient infrastructure
Retry automatically within policy when evidence indicates runner/network/service instability and no code change is required.

### Dependency/install
Inspect lockfile/runtime/registry evidence. Route to test-repair when repository changes are needed.

### Compilation/unit/E2E/visual
Route to test-repair or the owning implementation worker. Preserve the same job and branch.

### Merge conflict
Route to repo-maintenance. Resolve semantically using both sides and source-of-truth contracts. Preserve unique work.

### Resource conflict
Do not race. Release/reorder resource leases or move to `CONFLICTED`/`RETRY_WAIT` until the conflicting owner completes.

### Credential/policy
Block immediately. Do not consume attempts repeatedly for missing secrets, denied environment access, or policy requirements that code cannot fix.

### Deployment
Preserve immutable candidate and deployment evidence. Release worker decides retry/rollback according to policy.

### Live verification
Do not mark done. Preserve deployed identity, diagnose route/runtime/cache/content mismatch, and rollback or repair according to release policy.

### Unknown
Gather more evidence/research before editing. After a failed hypothesis, materially change the hypothesis rather than repeating the same repair.

## Branch recovery matrix

### Worker disappeared, branch has no unique work
Safe to clear expired lease and requeue after confirming no PR/deployment is active.

### Worker disappeared, branch has unique commits
Preserve branch. Assign recovery/repair to the same branch and record prior worker/lease as expired.

### Worker disappeared, PR is open
Preserve PR and branch. Reconcile head/checks/reviews; resume repair or integration from real PR state.

### PR closed without merge
Preserve unique branch commits. Determine whether superseded, intentionally cancelled, or needs recovery. Do not auto-delete unique work.

### PR merged but job still active
Reconcile to merged SHA. Continue release stages if production-impacting; otherwise complete when repository acceptance is satisfied.

### Branch exists but job marker/lease is missing
Treat as partial API failure. Inspect branch ancestry/commits/project metadata and reconnect it to the intended job when evidence is sufficient. Do not create a duplicate branch first.

### Successful check belongs to old SHA
Mark verification stale and rerun against current head.

## Production verification

Production-impacting acceptance is separate from repository verification.

Required evidence should include as applicable:

- immutable release/merge SHA;
- deployment workflow/result;
- target environment;
- exact public route/service;
- expected release identity or asset fingerprint;
- HTTP/runtime health;
- browser console/network health;
- critical visitor interaction;
- rollback/backup record when required.

For dtfseeds.com also follow `.agents/skills/dtfseeds-production-publishing/SKILL.md` and route-specific deployment documentation.

## Reconciliation cadence

Scheduled orchestration should reconcile before dispatch. This prevents expired leases, orphan branches, stale checks, and already-merged work from consuming worker capacity or producing duplicate jobs.

Reconciliation is deterministic control-plane work. It may create a repair/recovery job, but should not make broad product edits itself.
