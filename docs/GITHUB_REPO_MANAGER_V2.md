# GitHub Repository Manager v2

The canonical repository-management skill is:

`.agents/skills/github-repo-manager/SKILL.md`

Version 2 expands the manager from a repair loop into an end-to-end repository operator. It now covers:

- repository health preflight;
- safe pull/push synchronization and divergence decisions;
- project/worktree isolation;
- semantic merge-conflict repair;
- exact-commit CI diagnosis and retry/research loops;
- branch protection, rulesets, and merge-queue awareness;
- least-privilege GitHub Actions permissions and secret boundaries;
- third-party Action supply-chain review;
- dependency, release, tag, rollback, revert, and reflog recovery;
- append-first canonical content preservation;
- proactive audits for duplicate publishers, race conditions, stale workflows, unsafe permissions, and other problems the user may not know to ask about;
- deployment handoff with separate live/runtime verification.

Validation:

`node scripts/validate-github-repo-manager-skill.mjs`

CI:

`.github/workflows/github-repo-manager-skill-ci.yml`
