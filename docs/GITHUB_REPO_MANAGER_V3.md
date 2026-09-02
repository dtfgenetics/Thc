# GitHub Repository Manager V3 Operating Profile

Canonical skill entry point:

`.agents/skills/github-repo-manager/SKILL.md`

V3 keeps the existing V2 end-to-end repository manager and strengthens its referenced platform-hardening contract. The goal is for the user to be able to authorize repository work in plain language without needing to know which Git/GitHub maintenance steps are required.

## What V3 manages

- repository health preflight and source-of-truth discovery;
- fetch/pull/push synchronization and divergence handling;
- isolated project branches/worktrees;
- coding, bug repair, regression coverage, builds, lint/type checks;
- semantic merge-conflict repair;
- pull-request creation, review, update, conflict repair, and integration;
- exact-head and merge-group CI diagnosis;
- evidence-based retry/research when a repair fails;
- dependency and lockfile repair;
- branch-protection/ruleset/merge-queue auditing;
- required-status-check correctness;
- GitHub Actions permissions, secrets, reusable-workflow and concurrency review;
- security scanning/dependency-review awareness;
- CodeRabbit review/fix/re-review integration when available;
- release/tag/revert/reflog recovery;
- append-first canonical content preservation;
- production deployment handoff and real runtime/visitor verification;
- continuous health sweeps for failures the user did not explicitly know to ask about.

## Operating state machine

For non-trivial work, the manager follows:

`inspect → isolate → reproduce → repair → narrow-test → review → synchronize → PR → exact-head CI → conflict/current-base check → merge/queue → post-merge CI → deployment handoff → runtime verification → cleanup/audit`

A failure moves the manager back to diagnosis rather than allowing later stages to be treated as proof of success.

## Governance research incorporated

The September 2026 refresh incorporates current GitHub guidance around:

- protected branches and repository rulesets;
- required status checks and stale/skipped-check failure modes;
- merge queues and the `merge_group` event;
- environments and deployment protection rules;
- least-privilege `GITHUB_TOKEN` permissions;
- reusable workflows;
- secret scanning and push protection;
- dependency review;
- workflow execution protections where available;
- merge-conflict resolution and recovery.

## DTFSeeds-specific behavior

For `dtfgenetics/Thc`:

- `main` is production.
- Prefer project/platform branches for repository-wide repair/integration work.
- Preserve independent concurrent projects and re-read the current `main` head before integration.
- Follow `docs/CONTENT_PRESERVATION_STANDARD.md` for canonical data/content.
- Follow `.agents/skills/dtfseeds-production-publishing/SKILL.md` when the user requests live dtfseeds.com changes.
- Repository merge success and public-site success are separate acceptance gates.

## Current governance observation

At the time of this V3 research pass, the GitHub branch metadata reports `main` as unprotected and the repository rulesets endpoint returns no rulesets. The current connector can audit this state but does not expose the administrative write required to configure GitHub rulesets/branch protection. Until server-side protection is configured, the repository manager must continue to use PR/test/current-head discipline operationally and report the missing enforcement as a governance risk.

Do not make this observation a permanent assumption: re-check actual GitHub settings during future repository audits.

## Validation

Run:

`node scripts/validate-github-repo-manager-skill.mjs`

The validator now checks both the V2 core skill markers and the V3 hardening profile markers.

CI workflow:

`.github/workflows/github-repo-manager-skill-ci.yml`
