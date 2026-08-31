---
name: github-repo-manager
description: Manage, repair, test, synchronize, merge, and push GitHub repositories end to end. Use for broken pushes, merge conflicts, failed GitHub Actions, branch divergence, repository audits, code fixes, dependency or workflow failures, pull requests, releases, or requests to get repository work safely onto main. If an attempted fix fails, diagnose the exact failure, research current authoritative sources, apply a new evidence-based fix, retest, and continue until the task passes or a genuine external blocker is proven.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with git or GitHub access; web research is strongly recommended for unresolved or version-sensitive failures.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# GitHub Repository Manager

Use this skill as the repository-control layer for engineering work. Its job is to move from an imperfect repository state to a tested, synchronized, reviewable, and verifiably successful state rather than merely describing what should be done.

## Core execution contract

When the user asks to fix, repair, reconcile, push, merge, manage, audit, deploy, or finish work in a repository:

1. Inspect the real repository state first.
2. Identify the source of truth and applicable repository instructions.
3. Make the smallest complete root-cause fix.
4. Test the changed behavior.
5. Commit and synchronize the change using the repository's branch policy.
6. Follow the CI result associated with the new commit.
7. If it fails, diagnose the exact failing job/step/log before changing more code.
8. Research unresolved or version-sensitive failures using current authoritative sources.
9. Apply a materially different evidence-based fix, retest, and follow CI again.
10. Continue until the requested repository state is passing or a genuine external blocker is established.

Do not stop at a repairable error and convert the task into a generic plan. Do not repeat the same failed action without new evidence.

## Authority order

Before editing, read instructions in this order when they exist:

1. Repository-level `AGENTS.md` or equivalent agent instructions.
2. Repository safety/source-of-truth instructions such as `CLAUDE.md`.
3. The skill for the subsystem being changed.
4. Route-, app-, package-, or deployment-specific documentation.
5. Current source code, tests, workflows, configuration, and recent commit history.

More specific current instructions beat older general notes. If two authoritative files conflict and the correct behavior cannot be inferred safely from code/tests/history, report the conflict instead of silently choosing a destructive interpretation.

## Repository discovery

For every new repository task, establish:

- repository owner/name;
- default and production branch;
- current head SHA;
- authenticated permissions;
- relevant open pull requests;
- recent failed CI/workflow runs;
- changed subsystem and source-of-truth files;
- whether the task includes deployment or only repository state.

For multi-repository work, make the dependency/order relationship explicit before writing. Never assume similarly named repositories are mirrors.

## Preserve user and concurrent work

- Treat unrelated existing work as owned by somebody else unless the task explicitly includes it.
- Re-read the destination branch head immediately before the final merge/ref update when concurrent work is possible.
- Never force-update a production branch merely to simplify conflict resolution.
- Never use a blanket `ours` or `theirs` merge strategy across a conflict set.
- Do not delete or replace files just because they are inconvenient to merge.
- Prefer source changes over editing generated artifacts when a generator/source-of-truth exists.

## Branch and integration policy

Follow the repository's documented branch policy. If none exists:

1. Create a focused repair/feature branch from the latest destination head.
2. Make atomic commits with messages that describe the root-cause change.
3. Open a small pull request targeting the intended branch.
4. Verify the PR head is still current before merge.
5. Merge only after applicable tests/checks pass or an explicitly documented exception applies.

For `dtfgenetics/Thc`, `main` is the production branch and the repository prefers small pull requests. Do not treat an unmerged repair branch as completed production work.

## Merge-conflict repair

When a branch, PR, cherry-pick, rebase, or main update conflicts:

1. Identify every conflicted path.
2. Read both sides plus surrounding code and relevant tests.
3. Determine the intended behavior from source-of-truth docs, current main, recent commits, and callers.
4. Preserve compatible changes from both sides where possible.
5. Remove conflict markers and validate syntax/structure.
6. Run tests covering each conflicted subsystem.
7. Review the final diff for accidental deletions, duplicate code, reverted fixes, or stale generated output.

If a conflict represents competing product decisions rather than mechanical code divergence, do not disguise that as a technical merge. Preserve the safest current behavior and report the unresolved product decision if necessary.

## Code and dependency repair

For code failures:

- Reproduce the failure locally when the environment permits.
- Fix the root cause, not just the visible assertion or error string.
- Add or update tests for changed behavior when practical.
- Avoid unrelated rewrites during a repair.

For dependency failures:

- Determine the exact installed and required versions.
- Read the relevant lockfile and package manager configuration.
- Prefer the smallest compatible upgrade/downgrade or configuration fix.
- Update lockfiles together with manifests.
- Do not mass-upgrade dependencies as a first response to one failure.
- Check migration notes and breaking changes before accepting a major-version change.

## GitHub Actions / CI repair loop

For every failed workflow associated with the task:

1. Find the run for the exact commit being evaluated.
2. Read job status, failed step, and logs.
3. Classify the failure before acting:
   - source/test failure;
   - build/type/lint failure;
   - dependency/runtime mismatch;
   - workflow YAML/configuration failure;
   - path/filter/trigger mistake;
   - permissions failure;
   - missing environment/secret configuration;
   - deployment/integration failure;
   - verifier/health-check false negative;
   - transient infrastructure/service failure.
4. For source/config failures, patch before rerunning.
5. For a credible transient failure, rerun only the affected failed job/run once before changing code.
6. Follow the new run until it settles.
7. If it fails again, return to diagnosis with the new evidence.

Never claim CI success based on an older green run that does not contain the new commit.

## Failure research escalation

If the first evidence-based repair does not solve the problem, or the error is unfamiliar/version-sensitive, read `references/failure-research.md` and perform the research loop.

Research is part of the repair, not a substitute for it. Use the findings to produce and apply the next fix whenever repository access and safety allow.

Do not repeatedly search generic summaries while ignoring the exact error, version, platform, workflow, or package involved.

## Workflow-file repair rules

When editing `.github/workflows/*` or reusable action configuration, verify:

- valid YAML;
- event triggers and path filters;
- branch filters;
- working directories;
- runner/OS assumptions;
- action versions;
- runtime versions;
- cache keys and lockfile paths;
- artifact paths;
- job dependencies (`needs`);
- permissions;
- environment names;
- secret variable names and availability boundaries;
- shell differences;
- deployment concurrency/cancellation behavior.

Never print or commit secret values. Secret names may be referenced when necessary to explain configuration.

## Repository audit mode

When asked to audit a repository, inspect at minimum:

- default branch and protection/rules where accessible;
- stale/diverged/open branches or PRs relevant to active work;
- unresolved merge conflicts;
- failing CI;
- broken or duplicated deployment paths;
- ignored or missing tests;
- dependency/config drift;
- orphaned generated artifacts;
- obsolete documentation that contradicts executable behavior;
- committed secrets or suspicious credential files by filename/pattern without exposing secret values;
- TODO/FIXME items only when they materially affect the requested goal.

Prioritize issues by production impact and dependency order. Repair high-confidence blockers instead of returning a long list with no action when the user has authorized fixes.

## Deployment handoff

Repository success and live deployment are separate states.

If the user asks to make a DTFSeeds change live, after repository integration activate and follow:

`../dtfseeds-production-publishing/SKILL.md`

Continue through the applicable production workflow and visitor-facing verification. A commit to `main` is not proof that the website changed.

For any other repository, read its deployment runbook and verify the actual target environment before saying deployed/live.

## Safety and irreversible operations

Never:

- commit tokens, passwords, private keys, `.env` files, or secret values;
- expose credentials in logs or reports;
- force-push production/main unless the repository explicitly requires it and the user has clearly authorized that destructive operation;
- delete branches, tags, releases, databases, production files, or large content sets merely to clear a failure;
- bypass required tests or protections and then report the result as healthy;
- rewrite history when a normal merge/revert/follow-up commit can safely solve the problem.

Before any destructive repair, prefer backup, revertability, and a forward fix.

## Hard blockers

A hard blocker is something the available tools cannot safely repair in the current run, such as:

- missing GitHub/write permission;
- a required secret that does not exist and cannot be provisioned through available tooling;
- a protected-environment approval that only an external authorized reviewer can grant;
- an external service outage confirmed by evidence;
- an unresolved destructive product decision where guessing would risk data or production integrity.

A failing test, merge conflict, broken workflow, dependency error, rejected push, or bad deployment script is not automatically a hard blocker.

When blocked, report the exact failed stage, evidence, the narrow external action required, and the repository state already completed. Do not call the task fixed.

## Completion gate

Do not report repository work complete until all applicable checks are true:

- [ ] Correct repository and destination branch identified.
- [ ] Repository instructions/source of truth read.
- [ ] Current destination head inspected.
- [ ] Root cause identified or evidence-backed repair hypothesis established.
- [ ] Change made in canonical source.
- [ ] Relevant tests/build/lint/type checks pass.
- [ ] Conflicts resolved without discarding unrelated work.
- [ ] Changes committed and integrated according to branch policy.
- [ ] CI for the exact integrated commit is passing, or a documented non-CI repository has equivalent validation.
- [ ] Failed repair attempts triggered diagnosis/research rather than blind repetition.
- [ ] Deployment/live verification completed when the user requested deployment.
- [ ] Remaining hard blockers or unverified states are stated precisely.

## Final report format

Keep the final report concise but evidence-based. Include:

- **Repository:** owner/name and destination branch.
- **Fixed:** root causes and files/subsystems changed.
- **Validation:** commands/checks and outcomes.
- **Git state:** commit SHA and PR/merge result when applicable.
- **CI:** exact new commit/run status.
- **Research:** only when failure research was needed; summarize what source/version evidence changed the fix.
- **Deployment:** separate repository state from live state.
- **Remaining:** only genuine blockers or known unverified items.
