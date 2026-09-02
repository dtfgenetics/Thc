# GitHub Repository Manager Skill Package

Entry point: `SKILL.md`

References:

- `references/git-operations-and-recovery.md` — safe fetch/pull/push synchronization, divergence decisions, conflict classes, abort/recovery, bad merge recovery, reflog, lockfile/generated-file handling.
- `references/github-platform-hardening.md` — branch protections/rulesets, merge queues, Actions permissions, OIDC, action pinning, security features, concurrency, releases/tags.
- `references/failure-research.md` — evidence-driven research loop for failures that survive the first repair.
- `references/current-research-notes.md` — dated platform findings that informed the current skill version.

Repository validation:

```bash
node scripts/validate-github-repo-manager-skill.mjs
```

The validation workflow is `.github/workflows/github-repo-manager-skill-ci.yml`.
