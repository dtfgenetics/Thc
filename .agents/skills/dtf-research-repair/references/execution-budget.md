# Execution Budget

The controller is optimized for useful completed work per run.

## Default allocation

Use these as adaptive targets, not hard time limits:
- 15-25% reconciliation/discovery/research;
- 50-60% implementation and repair;
- 20-30% verification/integration/release/handoff.

If durable state already contains confirmed ready work, reduce discovery and begin execution immediately.

## Continue-work rule

After every completed or blocked action, ask: **what is the highest-value safe executable action now?**

Continue when:
- another ready job is independent;
- a downstream integration/release step became ready;
- a failed check has an actionable in-scope repair;
- content/data/assets required by acceptance criteria remain incomplete.

Stop only when:
- no safe executable work remains;
- remaining work is externally blocked or permission denied;
- continuing would consume verification/handoff capacity;
- a required human decision is genuinely ambiguous.

## Substantive repair

Examples include restoring a broken user flow, implementing missing requested behavior/content/data/assets, repairing a false-green verifier, adding meaningful regression protection, resolving release ownership/drift, or completing a release with verified live behavior.

Formatting-only edits, status prose, labels, counts, and repeated audits do not satisfy the substantive-repair target by themselves.

## Anti-loop policy

For each resource record:
- first no-op inspection: persist evidence and next action;
- second consecutive no-op: require new evidence/state to justify another inspection;
- third would-be no-op: do not inspect again. Execute the next action, research the unresolved uncertainty, or rotate.

Reset the no-op counter after a material state change, repair, new failure, new deployment, or materially new evidence.

## Throughput metrics

Persist per run when the existing ledger supports it:
- candidates considered;
- independent areas inspected;
- confirmed issues;
- ready jobs attempted;
- substantive repairs completed;
- PRs opened/updated/merged;
- deployments/live verifications;
- content/data units completed;
- blocked jobs advanced;
- repeated no-op inspections;
- repeat-audit rate.

These metrics diagnose automation quality. They are never quotas for inventing work.
