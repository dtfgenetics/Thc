---
name: github-repo-manager
description: Operate, repair, synchronize, code, test, review, merge, release, and recover GitHub repositories end to end. Use for pushes/pulls, branch divergence, merge conflicts, failed Actions, broken builds, dependency failures, PR integration, repository audits, releases, production handoff, or requests to finish repository work without the user needing to know each Git/GitHub step. If a repair fails, diagnose the exact evidence, research current authoritative sources, change the hypothesis, retest, and continue until the requested state passes or a genuine external blocker is proven.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with git/GitHub access. Current web research is required for unfamiliar, security-sensitive, or version-sensitive GitHub/platform behavior.
metadata:
  author: dtfgenetics
  version: "2.0.0"
---

# GitHub Repository Manager

Use this skill as the repository-control layer for engineering work. The user should be able to say things such as **fix the repo**, **push this**, **pull the latest work**, **merge everything that is ready**, **fix conflicts**, **repair CI**, **finish the code**, or **get this live** without knowing the underlying Git/GitHub mechanics.

The goal is not to perform isolated Git commands. The goal is to move the repository from its real current state to a synchronized, tested, reviewable, recoverable, and verifiably successful state while preserving unrelated work.

## Non-negotiable execution contract

When the user authorizes repository work:

1. Inspect the real repository, branch, PR, workflow, and instruction state first.
2. Identify the source of truth and the intended destination branch/environment.
3. Preserve unrelated and concurrent work.
4. Make the smallest complete root-cause change.
5. Validate locally or through the narrowest available automated check.
6. Synchronize using the repository's branch/worktree policy.
7. Open/update the PR or otherwise integrate through the repository's approved path.
8. Follow CI for the **exact new commit**.
9. If it fails, inspect the exact failing run/job/step/log before editing more code.
10. Research current authoritative sources when the behavior is unfamiliar, security-sensitive, version-sensitive, or the first evidence-based repair did not work.
11. Apply a materially different evidence-backed repair and retest.
12. Continue until the requested state passes or a genuine external blocker is established.
13. If deployment is requested, continue through the owning deployment skill/workflow and visitor/runtime verification. A merge to `main` is not proof that production changed.

A repairable failure is not a stopping point. Do not turn a failing test, conflict, rejected push, or broken workflow into a generic plan when the available tools can continue the repair.

## Authority order

Before editing, read current instructions in this order when they exist:

1. repository `AGENTS.md` or equivalent agent instructions;
2. repository safety/source-of-truth file such as `CLAUDE.md`;
3. project-isolation/worktree instructions;
4. this skill;
5. subsystem-specific skills and source-of-truth documentation;
6. deployment/publishing instructions when live state is in scope;
7. current source, tests, workflows, configuration, PRs, and recent commit history.

More specific current instructions beat older general notes. If authoritative instructions truly conflict and safe behavior cannot be inferred from tests/history/source ownership, preserve the safer state and surface the conflict rather than silently choosing a destructive interpretation.

For `dtfgenetics/Thc`, also follow:

- `.agents/skills/parallel-project-manager/SKILL.md`
- `docs/PARALLEL_PROJECT_WORKFLOW.md`
- `docs/CONTENT_PRESERVATION_STANDARD.md` when canonical content/data is touched
- `.agents/skills/dtfseeds-production-publishing/SKILL.md` when dtfseeds.com live state is requested

## Repository preflight: build a health packet first

For every non-trivial repository task, establish as many of these as the available tooling supports:

- repository owner/name and remote URLs;
- default branch and production branch;
- current destination head SHA;
- current working branch/worktree and uncommitted changes;
- upstream tracking and ahead/behind/divergence state;
- relevant open PRs and their mergeability;
- current required checks and exact PR/head check state;
- recent failed/cancelled workflow runs relevant to the task;
- branch protection and repository rulesets;
- merge queue state when configured;
- relevant environments/deployment gates;
- changed subsystem and canonical source files;
- package manager/runtime/lockfiles for the changed code;
- whether the task affects generated artifacts, canonical content, binaries, releases, or production;
- whether another active branch/PR appears to modify the same ownership surface.

Do not assume a branch is protected merely because it is named `main`. Do not assume a repository has no rules because the legacy branch-protection API is empty; inspect rulesets too when accessible.

If `main`/production is unprotected, report that as a governance risk but **do not exploit it**. Continue to use PR, validation, and synchronization discipline unless the repository has an explicit different policy.

## Intent router

Translate common user requests into complete operations.

### "Pull the latest" / "sync this"

Do not begin with a blind `git pull`. Read `references/git-operations-and-recovery.md` and inspect status/divergence first. Fetch, then choose fast-forward, rebase, merge, or branch preservation deliberately.

### "Push this"

Verify the active project branch, uncommitted diff, destination remote, tests, upstream state, and current target head. Push the intended branch. Open/update a PR when repository policy expects one. Do not push accidental unrelated changes.

### "Merge this" / "merge what is ready"

For each candidate PR:

- verify scope and destination;
- verify it is not superseded by a newer PR;
- inspect conflicts and review comments;
- verify required checks for the exact head;
- ensure the target has not moved incompatibly;
- use the configured merge queue when required;
- merge using repository policy;
- follow post-merge CI/deployment when relevant.

Do not bulk-merge merely because several PRs show green independently if they overlap or share a production ownership surface.

### "Fix conflicts"

Use semantic conflict repair, not blanket side selection. Read `references/git-operations-and-recovery.md`.

### "Fix the repo" / "audit everything"

Enter repository audit mode below. Prioritize high-impact blockers and repair high-confidence issues instead of returning only a long checklist.

### "Fix the code"

Reproduce the failure, identify the owning subsystem/source, patch the root cause, add/update tests when practical, run the narrowest checks first, then repository-required gates.

### "Fix GitHub Actions"

Follow the exact-run CI repair loop below. Treat permissions, event context, path filters, concurrency, environment protection, runner/runtime drift, and verifier false-negatives as first-class failure categories.

### "Release/tag this"

Use the release safety section. Never move/delete historical tags casually.

### "Make it live"

Repository integration is only the first half. Hand off to the actual deployment owner and verify the real target environment.

## Preserve user, canonical, and concurrent work

- Treat unrelated existing changes as owned by somebody else unless explicitly included.
- Use the repository's worktree/parallel-project model instead of switching a shared checkout between simultaneous projects.
- Re-read the destination head immediately before the final integration step.
- Never force-update `main`/production merely to simplify history.
- Never use blanket `ours` or `theirs` across a conflict set.
- Never delete files because they are inconvenient to merge.
- Prefer canonical source changes over editing generated output.
- When canonical content/data is append-only or preservation-controlled, additions must not silently replace existing records. Follow `docs/CONTENT_PRESERVATION_STANDARD.md` and its authorization rules.
- Mutable pointers such as "current batch", generated catalogs, deployment manifests, or indexes are not authorization to truncate canonical source.

## Branch, worktree, and integration policy

Follow documented repository policy. If none exists, default to:

1. fetch the latest destination state;
2. create a focused branch from the current destination head;
3. isolate it in its own worktree when parallel work is active;
4. make atomic commits describing root-cause changes;
5. open a small PR;
6. verify the PR head and target are still compatible;
7. require applicable checks;
8. merge through the configured repository mechanism;
9. delete/retire branches only when doing so is safe and authorized.

For `dtfgenetics/Thc`:

- `main` is production;
- repository-wide integration/CI/deployment work should use `project/platform/<task>`;
- ordinary project work should use the project-specific branch/worktree convention;
- existing legacy in-flight branches remain valid and should not be rewritten just to normalize names;
- prefer small PRs and preserve independent project work.

### Rebase vs merge vs cherry-pick

Do not choose by habit.

- Rebase a private/owned feature branch when policy permits and a clean linear update is useful.
- Merge the target into a shared feature branch when rewriting shared branch history would be risky.
- Cherry-pick only when one specific commit semantically belongs on another line of development and its dependencies are understood.
- Never rebase or reset shared production history merely for tidiness.
- If a merge queue is configured, let it perform the final compatibility test rather than repeatedly rewriting branches to mimic it.

## Merge-conflict repair

Classify conflicts before resolving them:

- content/content;
- modify/delete;
- rename/rename;
- add/add;
- generated/lockfile;
- binary;
- product/behavior conflict.

For each conflicted path:

1. inspect base plus both sides when available;
2. read source-of-truth docs, callers, tests, and recent commits;
3. identify independent behavior introduced by each side;
4. construct the desired combined behavior where compatible;
5. regenerate derived output from reconciled source when applicable;
6. validate syntax/types/tests for the conflicted subsystem;
7. search for conflict markers, duplicate blocks, stale generated files, and accidental deletions;
8. compare the final result against both parents.

A conflict between two legitimate product decisions is not a mechanical Git problem. Preserve the safest current behavior and surface the unresolved decision if it cannot be inferred safely.

Be careful with Git's `ours`/`theirs` terminology: its meaning can be counterintuitive during rebase/cherry-pick. Inspect actual content and commit identities instead of trusting the label.

## Pull/push and divergence rules

Read `references/git-operations-and-recovery.md` for the detailed decision matrix.

Core rules:

- fetch before integrating remote changes;
- prefer fast-forward-only when a local branch has no unique work;
- preserve unique local commits before repairing a divergent production branch;
- push an explicit intended branch/remote;
- never plain-force push;
- `--force-with-lease` is only acceptable for a non-production branch whose rewritten history is explicitly owned by the current work and repository policy permits it;
- never discard unknown uncommitted changes with `reset --hard`, `clean -fd`, or blind stash workflows.

## Code repair

For code failures:

- reproduce the failure when possible;
- isolate the smallest failing behavior;
- inspect recent changes around the failure;
- fix the root cause rather than only editing the assertion/error text;
- add/update regression coverage when practical;
- run the narrowest test first, then package/app build, then repository-required checks;
- avoid unrelated refactors in a production repair.

When a bug spans generated output and source, fix source first and regenerate.

## Dependency repair

- Identify the repository's actual package manager and lockfile.
- Determine installed and required versions.
- Read official migration/release notes for major changes.
- Prefer the smallest compatible version/configuration fix.
- Update manifest and lockfile together.
- Do not mass-upgrade dependencies as the first response to one failure.
- Audit whether a dependency change alters runtime, build, browser, server, or deployment compatibility.
- Treat automated dependency PRs as untrusted until their tests and security implications are understood.

## GitHub Actions / CI repair loop

For every failed workflow in scope:

1. Find the workflow run for the exact evaluated commit or merge-group commit.
2. Read job status, failed step, annotations, and logs.
3. Compare with a recent known-good run when useful.
4. Classify before acting:
   - source/test failure;
   - build/type/lint failure;
   - dependency/runtime mismatch;
   - workflow YAML/configuration failure;
   - event/path/branch filter mistake;
   - matrix-only failure;
   - cache/artifact corruption or path mismatch;
   - token/permission failure;
   - missing secret/environment configuration;
   - protected-environment approval;
   - concurrency/cancellation race;
   - deployment/integration failure;
   - verifier/health-check false negative;
   - transient GitHub/runner/provider failure.
5. For source/config failures, patch before rerunning.
6. For a credible transient infrastructure failure, rerun only the affected job/run once when available.
7. Follow the resulting run to completion.
8. If it fails again, read the **new** evidence and challenge the previous hypothesis.

Never claim CI success from an older green run that does not contain the new commit.

When merge queues are enabled, required workflows may need to run for `merge_group`. Follow the queue-created compatibility result, not only the original PR event.

## Workflow-file and GitHub security rules

When editing `.github/workflows/*`, reusable workflows, or actions configuration, inspect:

- YAML validity;
- event triggers, including `pull_request`, `push`, `workflow_dispatch`, `workflow_run`, and `merge_group` when applicable;
- path and branch filters;
- runner/OS/runtime assumptions;
- working directories;
- action versions and supply-chain trust;
- package caches and lockfile paths;
- artifacts and retention;
- job dependencies and conditions;
- explicit `permissions`;
- environment names/protection;
- secret availability boundaries;
- fork/Dependabot behavior;
- reusable-workflow permission inheritance;
- shell differences;
- concurrency groups and `cancel-in-progress` semantics;
- deployment rollback/restart behavior.

Read `references/github-platform-hardening.md` for the full platform-security baseline.

Security defaults:

- grant `GITHUB_TOKEN` the least permissions required;
- prefer built-in `GITHUB_TOKEN` for same-repository operations;
- prefer GitHub Apps or short-lived identity over broad long-lived PATs when extra capability is required;
- prefer OIDC for supported cloud-provider authentication rather than long-lived cloud secrets;
- do not expose secrets to untrusted PR code;
- for third-party actions, prefer audited actions pinned to a verified full-length commit SHA when practical;
- never print or commit secret values.

## Repository audit mode: find the things the user did not know to ask about

When asked to manage, improve, or audit a repository broadly, inspect and prioritize:

### Integrity and integration

- default/production branch correctness;
- branch protection and rulesets;
- merge queue configuration for high-concurrency repos;
- stale/diverged/open PRs affecting active work;
- superseded duplicate PRs;
- unresolved conflicts;
- accidental direct-to-production workflow paths;
- branch/worktree collisions between parallel projects.

### CI/CD

- currently failing checks;
- cancelled/superseded runs incorrectly treated as failures;
- duplicate workflows performing the same mutation;
- incorrect path filters or event triggers;
- missing `merge_group` support where a merge queue requires it;
- dangerous deployment concurrency;
- workflows with overly broad token permissions;
- unpinned/high-risk third-party actions;
- missing rollback or visitor/runtime verification for production writers;
- workflows that advance a publication pointer even when the prior publish failed.

### Source and build health

- missing/ignored tests for critical behavior;
- dependency/runtime drift;
- lockfile mismatch;
- generated artifacts diverging from canonical source;
- dead scripts/workflows still referenced by docs;
- obsolete docs contradicting executable behavior;
- duplicate sources of truth;
- TODO/FIXME only when they materially affect the requested goal.

### Content/data preservation

- replacement-style publishers that can truncate existing collections;
- mutable "current" files being mistaken for canonical history;
- missing append/reconcile semantics;
- missing backup/rollback around production mutations;
- IDs/slugs/routes that can collide or silently overwrite earlier records.

### Security

- suspicious committed credential files/patterns without redisplaying values;
- effective secret scanning/push protection/code scanning/Dependabot state when accessible;
- broad PAT usage where a GitHub App, `GITHUB_TOKEN`, or OIDC would be safer;
- risky `pull_request_target` or equivalent execution of untrusted code with write/secrets;
- missing CODEOWNERS/ownership controls for sensitive paths when appropriate.

### Releases and recovery

- tags/releases pointing at unexpected commits;
- unreproducible release artifacts;
- missing recovery/rollback documentation;
- destructive scripts without dry-run/backups;
- orphaned branches only after confirming they are not active work.

Prioritize by production/data-loss/security impact and dependency order. Fix high-confidence blockers when authorized instead of stopping at an audit list.

## Release and tag safety

Before creating, editing, moving, or deleting a release/tag:

1. identify consumers and deployment/package dependencies;
2. verify the commit has the required tests/checks;
3. verify artifact/source provenance when applicable;
4. prefer a new corrective release over rewriting historical release identity;
5. do not delete a failed release merely to hide evidence;
6. understand whether the repository intentionally uses floating major/minor tags for reusable Actions before moving them.

## Recovery and rollback

Prefer the least destructive recovery:

1. fix forward with a new commit;
2. revert a bad shared commit/merge;
3. abort an in-progress merge/rebase/cherry-pick when the resolution path is unclear;
4. recover local commits using reflog and create a branch/ref pointing to them;
5. rewrite only private explicitly owned history when necessary;
6. repository-wide history rewriting is exceptional and requires explicit destructive authorization.

For a bad merge already on shared `main`, prefer a tested revert over resetting production history backward.

Never delete evidence merely to make history look cleaner.

## Failure research escalation

If the first evidence-based repair does not solve the problem, the error is unfamiliar, or behavior depends on current GitHub/package/runtime/provider rules, read `references/failure-research.md` and research before the next attempt.

Research order should prefer:

1. official product/tool documentation for the actual current version;
2. official changelog/release/migration/deprecation notes;
3. upstream maintainer issues/discussions for the exact error;
4. current GitHub Actions/platform documentation;
5. hosting/provider documentation;
6. high-quality community reports only after primary sources.

Research must change the next hypothesis. Do not search as a substitute for making the next safe fix.

## Parallel work and race prevention

Multiple projects may proceed concurrently. Serialize only shared mutation points.

Before integrating:

- re-read `main`/destination head;
- detect overlapping changed paths/ownership surfaces among open PRs;
- do not overwrite a newer main state with an older branch snapshot;
- use worktrees/project branches for isolation;
- for production workflows sharing one target, use transaction-safe concurrency and backups rather than preventing all parallel development.

## Deployment handoff

Repository success and live deployment are separate states.

For DTFSeeds live work, after repository integration follow:

`../dtfseeds-production-publishing/SKILL.md`

Continue through the correct route owner, protected production workflow, rollback contract, and visitor-facing verification. A commit, PR merge, successful build, or successful WordPress/API write is not by itself proof of live success.

For other repositories, read the actual deployment runbook and verify the real target environment/runtime before saying deployed.

## Safety and irreversible operations

Never:

- commit or expose tokens, passwords, private keys, secret values, `.env` files, authorization headers, or private user data;
- force-push `main`/production;
- silently bypass branch/ruleset/check requirements;
- reset shared production history merely to simplify recovery;
- delete branches/tags/releases/large content sets only to clear an error;
- blanket-resolve conflicts with `ours`/`theirs`;
- execute destructive cleanup when backup/revert/forward repair is available;
- run untrusted PR code with privileged secrets without a repository-designed security boundary;
- call a repository or deployment healthy because an unrelated older run passed.

## Hard blockers

A genuine hard blocker is something the available tools cannot safely repair in the current run, for example:

- missing repository/write/admin permission required for the requested change;
- a required credential/environment secret does not exist and cannot be provisioned with available tooling;
- a protected-environment approval requires an external authorized reviewer;
- an external provider outage is confirmed;
- a destructive product/data decision cannot be inferred safely;
- required local execution capability is unavailable and no equivalent CI/remote path can validate the change.

A failing test, merge conflict, broken workflow, rejected push, dependency error, stale branch, or incorrect deployment script is not automatically a hard blocker.

When blocked, report the exact stage, evidence, narrow external action required, and the last completed repository state. Do not call the task fixed.

## Completion gate

Do not report repository work complete until all applicable checks are true:

- [ ] Correct repository and destination branch identified.
- [ ] Repository instructions and project-isolation rules read.
- [ ] Current destination head and relevant concurrent work inspected.
- [ ] Branch protection/ruleset/merge-queue behavior understood when relevant.
- [ ] Root cause identified or evidence-backed repair hypothesis established.
- [ ] Canonical source changed without silently overwriting unrelated/canonical work.
- [ ] Relevant unit/integration/build/lint/type checks pass.
- [ ] Conflicts resolved semantically without discarding required behavior.
- [ ] Changes synchronized and integrated according to branch policy.
- [ ] CI for the exact integrated commit/merge group is passing, or equivalent validation is documented.
- [ ] Failed attempts triggered diagnosis/research rather than blind repetition.
- [ ] Security/permissions implications of workflow changes were reviewed.
- [ ] Deployment/live verification completed when requested.
- [ ] Remaining hard blockers or unverified states are stated precisely.

## Final report format

Keep the final report concise and evidence-based:

- **Repository:** owner/name, destination branch, final SHA.
- **Fixed:** root causes and files/subsystems changed.
- **Validation:** relevant tests/checks and outcomes.
- **Git state:** branch, PR, merge/revert/release result.
- **CI:** exact new commit/merge-group run status.
- **Governance/security:** only material findings such as unprotected production branch, missing ruleset, broad permissions, or risky workflow behavior.
- **Research:** authoritative source/version facts only when research changed the repair.
- **Deployment:** clearly separate repository state from live/runtime state.
- **Remaining:** genuine blockers or known unverified items only.

## References

- `references/git-operations-and-recovery.md` — synchronization, push/pull, divergence, conflicts, rollback, reflog, bad merge recovery.
- `references/github-platform-hardening.md` — rulesets, branch protection, merge queues, Actions permissions, OIDC, action pinning, security scanning, concurrency, release/tag safety.
- `references/failure-research.md` — evidence packet, authoritative research order, retry/research discipline.
