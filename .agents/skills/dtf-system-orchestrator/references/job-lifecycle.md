# Durable Job Lifecycle

This reference defines the machine-operable lifecycle used by the DTF System Orchestrator. Use it with `docs/DTF_SYSTEM_OPERATING_ARCHITECTURE.md` and the configuration under `configuration/orchestrator/`.

## Job record

Every non-trivial job should be representable with these fields. Runtime storage may be an issue marker, API-backed record, workflow artifact, or later durable database; the semantics must remain stable.

```json
{
  "schemaVersion": 2,
  "jobId": "stable unique id",
  "issueId": 0,
  "title": "bounded requested outcome",
  "state": "READY",
  "project": "canonical project id",
  "repository": "owner/repo",
  "workerKind": "code",
  "priority": "p2",
  "branch": null,
  "baseBranch": "main",
  "baseSha": null,
  "resourceSet": [],
  "verificationProfile": null,
  "retryPolicy": "implementation",
  "attempt": 0,
  "maxAttempts": 3,
  "lease": null,
  "prNumber": null,
  "expectedHeadSha": null,
  "productionImpact": false,
  "productionTargets": [],
  "dependencies": [],
  "acceptanceCriteria": [],
  "lastFailure": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Canonical states

Normal path:

`DISCOVERED -> PLANNED -> READY -> LEASED -> RUNNING -> VERIFYING -> PR_OPEN -> INTEGRATION_READY -> MERGED -> STAGING -> PRODUCTION_READY -> DEPLOYING -> LIVE_VERIFYING -> DONE`

Exceptional states:

`BLOCKED`, `RETRY_WAIT`, `REPAIRING`, `CONFLICTED`, `LEASE_EXPIRED`, `QUARANTINED`, `CANCELLED`, `SUPERSEDED`.

Do not infer completion from labels alone. Validate state against branch, PR, workflow, deployment, and live evidence.

## Transition rules

### DISCOVERED -> PLANNED
Require a requested outcome, canonical project lookup, and enough evidence to determine whether the work is actionable. Broad requests may produce multiple planned jobs.

### PLANNED -> READY
Require canonical repository, worker kind, acceptance criteria, resource claims, verification profile, retry policy, dependencies, and production-impact classification. Unresolved ownership means `BLOCKED`, not `READY`.

### READY -> LEASED
Require worker capacity, no conflicting exclusive resource lease, dependencies complete, and retry backoff elapsed. Create a unique lease ID and expiry. A lease is renewable ownership, not a permanent claim.

### LEASED -> RUNNING
Require the matching lease and one managed branch. Record base SHA before edits. If branch creation succeeds but state persistence fails, reconciliation must discover the branch rather than create a replacement.

### RUNNING -> VERIFYING
Require implementation to be saved on the same managed branch. Record exact head SHA. Select verification from changed resources/project ownership.

### VERIFYING -> PR_OPEN
Require all pre-PR mandatory checks to pass for the exact head. If verification fails, classify failure and route to repair/retry/block instead.

### PR_OPEN -> INTEGRATION_READY
Require PR target matches declared base, PR head equals expected head, required checks are green on that exact head, ownership remains valid, and no forbidden resource conflict exists.

### INTEGRATION_READY -> MERGED
Merge only through repository policy. Record resulting merge SHA. Never substitute a stale successful check from an earlier head.

### MERGED -> DONE
Allowed only for work with `productionImpact=false` and acceptance criteria that end at repository integration.

### MERGED -> STAGING
Required for production-impacting work when staging exists or the release contract requires it.

### STAGING -> PRODUCTION_READY
Require staging acceptance and immutable release candidate identity.

### PRODUCTION_READY -> DEPLOYING
Require release-worker authority, protected environment when configured, exclusive production-target lease, and rollback/backup evidence where applicable.

### DEPLOYING -> LIVE_VERIFYING
Require deployment command/workflow success and deployed candidate identity.

### LIVE_VERIFYING -> DONE
Require visitor-facing verification of exact routes/services and critical acceptance behavior. A deployment command succeeding is not enough.

## Lease contract

```json
{
  "leaseId": "uuid",
  "workerId": "worker identity",
  "workerKind": "code",
  "acquiredAt": "timestamp",
  "renewedAt": "timestamp",
  "expiresAt": "timestamp"
}
```

Heartbeats must match both `leaseId` and `workerId`. A heartbeat after expiry must not silently resurrect ownership; reconciliation decides recovery.

## Expired lease recovery

Inspect the branch before requeueing:

1. No branch or no unique commits and no open PR: clear lease and safely return to `READY` or `RETRY_WAIT`.
2. Unique commits exist: preserve branch, move to `LEASE_EXPIRED`/`REPAIRING`, and resume the same branch.
3. Open PR exists: preserve branch and PR; reconcile checks/head/state before assigning repair or integration work.
4. Production deployment may be in progress: do not requeue implementation. Block/reconcile release state first.

Never delete unique work merely because a lease expired.

## Failure classification

Use the retry policy configuration. Minimum classes:

- transient-infrastructure
- dependency-install
- compilation
- unit-test
- e2e
- visual-regression
- merge-conflict
- resource-conflict
- credential-or-policy
- deployment
- live-verification
- security
- unknown

Credential/policy failures should block rather than loop. Code/test failures should normally route to a repair worker on the same branch. Exceeding maximum attempts moves the job to `QUARANTINED` with evidence preserved.

## Idempotency rules

Commands and workflow steps must tolerate retries:

- `create`: do not duplicate an existing stable job for the same explicit job ID.
- `dispatch`: do not issue a second active lease for the same job.
- `start`: reuse the recorded managed branch.
- `heartbeat`: update only a matching active lease.
- `check`: attach results to the exact head SHA.
- `retry`: increment attempt once per failed attempt, not once per API retry.
- `complete`: refuse when required downstream production/live states remain.
- `reconcile`: repair state from GitHub/runtime truth without destroying unique work.

## Reconciliation invariants

Continuously detect and repair or report:

- claim/lease without branch;
- branch without job/lease;
- expired lease;
- unique branch commits with no active worker;
- duplicate active jobs for one exclusive resource;
- closed-unmerged PR;
- merged PR whose job remains running;
- stale successful checks for old head SHA;
- unexpected base/head movement;
- failed workflow awaiting repair;
- deployment from unexpected SHA;
- production drift;
- orphan or superseding branches.

## Completion evidence

A completed job should retain:

- final job state and transition history;
- canonical repository/project;
- final branch/PR/merge SHA;
- exact verification head SHA and check evidence;
- retry/failure history if any;
- deployment candidate/deployment evidence when applicable;
- live route/service verification when applicable;
- unresolved warnings that did not block acceptance.
