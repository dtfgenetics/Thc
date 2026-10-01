# GitHub Actions Portfolio Cleanup

The production integration repository carries hundreds of workflow files accumulated across CI, deployment, publishing, diagnostics, repairs, recoveries, and one-off release work.

## Rule

Do not delete workflows by filename or age alone.

Classify each workflow by trigger and operational role first. A workflow may be retired only when its active responsibility has a documented canonical replacement or the workflow itself is explicitly historical or legacy.

## Repeatable audit

Run:

```bash
npm run audit:workflow-portfolio
```

To emit a machine-readable report:

```bash
node scripts/audit-workflow-portfolio.mjs --write reports/workflow-portfolio.json
```

The audit records trigger types, broad category, manual-only status, production-writing signals, and a conservative historical-candidate flag.

## Retirement sequence

1. Start with manual-only repair, recovery, diagnostic, force, publish, and deploy workflows.
2. Confirm the replacement workflow or current production path.
3. Move retired workflow YAML to `docs/archive/workflows/` instead of deleting its history.
4. Add a short retirement note naming the replacement.
5. Keep active CI, route ownership, canonical-mirror guards, release gates, and reusable deployment workflows in `.github/workflows/`.
6. Re-run the audit after each retirement batch.

The first completed retirement moved the explicitly legacy `hostinger-game-route-repair.yml` out of the executable workflow directory while preserving its contents.
