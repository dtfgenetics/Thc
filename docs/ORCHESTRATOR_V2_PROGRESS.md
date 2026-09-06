# Orchestrator V2 Progress

Branch: `project/github-worker-orchestrator/v2-ready`

## Implemented

- System operating architecture and acceptance contract.
- Reusable `dtf-system-orchestrator` agent skill with lifecycle, routing, verification, recovery, and multi-repo references.
- Worker capability, retry/recovery, and verification-profile configuration.
- V2 worker-orchestrator configuration with expanded labels, worker kinds, lease settings, policy references, and safety controls.
- Durable job state-machine primitives in `scripts/orchestrator/state.mjs`.
- Renewable lease, heartbeat, expiry, ownership validation, and recovery-disposition primitives in `scripts/orchestrator/leases.mjs`.
- V1 planner compatibility through `scripts/orchestrator/core.mjs` while accepting V2 configuration.
- Lease-backed dispatch records.
- `start` lifecycle command with matching worker/lease enforcement.
- `heartbeat` lifecycle command with expiry and ownership enforcement.
- Status output distinguishes active and expired claims.
- Dispatch refuses to continue past expired claims when `reconcileBeforeDispatch` is enabled.
- Expanded deterministic lifecycle tests.
- Workflow syntax/tests include V2 modules and report expired claims.

## Next implementation tranche

- `create` and `update` structured job commands.
- `reconcile` command that inspects branch unique commits, open PRs, and stale leases before choosing requeue/repair/preserve behavior.
- `check` command and verification-profile router tied to exact candidate head SHA.
- `fail`, `retry`, `block`, and quarantine transitions using configured retry policies.
- PR/head integration-state tracking and `INTEGRATION_READY` gate.
- Multi-repository ownership adapter from `data/project-registry.json`.
- Release/live-QA adapters for production-impacting jobs.

## Safety invariants already enforced

- No direct main push through orchestrator policy.
- One managed branch per normal job path.
- Existing branch reuse is refused during a fresh claim.
- Heartbeats require exact active lease ID and worker identity.
- Expired leases cannot be silently revived by heartbeat/start.
- Production-impacting jobs cannot transition from `MERGED` directly to `DONE`.
- Unique work is intended to be preserved during stale-worker recovery; full GitHub-aware reconciliation is the next tranche.
