# Branch lifecycle and convergence contract

This repository supports many simultaneous agents and projects, but every remote branch must move toward one of two terminal states: **integrated** or **explicitly retired**. Remote branches are not permanent storage for unfinished sessions.

## The pull request is the task claim

Do not maintain a shared `ACTIVE_WORK.md` lock file. A central mutable claim file would become another high-conflict hotspot.

For Studio work, the remote pull request is the durable task/session handoff. `studio:push` already records structured session, project, task, head SHA, affected resources, and production targets in the PR body.

Rules:

1. New concurrent work uses a unique `work/<project>/<task>/<session>` branch.
2. Continuing known work uses `node scripts/studio.mjs resume <branch-or-pr>`.
3. A remote managed branch should have an open PR unless it is already integrated or intentionally being recovered/retired.
4. Agents must inspect existing PRs/Studio overlap before treating a same-project/same-task session as replacement work.
5. Do not delete an older branch merely because a newer branch looks similar. Preserve unique behavior/content first.

## Lifecycle states

### active-pr

The branch has an open PR. Keep it. The PR is the current coordination record.

### integrated

The branch has no open PR and either:

- its PR merged; or
- its branch tip is already an ancestor of `main`.

Managed `work/*`, `project/*`, and `multi/*` branches in this state are safe remote-cleanup candidates.

### closed-unmerged

The branch only has closed, unmerged PRs. Preserve it until unique work is reviewed. It may be explicitly abandoned only after confirming that no needed change exists solely on that branch.

### orphan-unique

The branch has unique history and no PR handoff. Preserve it. Recover it into a PR, supersede it after preserving unique work, or explicitly abandon it. Never bulk-delete this state.

## Commands

Audit without mutation:

```bash
node scripts/studio.mjs lifecycle
```

The audit reports branch counts, lifecycle state, duplicate Studio task claims, and safe cleanup candidates.

Delete only provably integrated managed remote branches:

```bash
node scripts/studio.mjs lifecycle --cleanup-merged
```

This command does **not** delete closed-unmerged or orphan-unique branches.

Normal Studio integration also retires the merged managed remote branch after the exact validated head is merged, provided no other open PR still uses that branch.

## Merge-or-retire rule

A finished task must not leave a managed remote branch indefinitely:

- successful task -> validate -> merge exact PR head -> delete merged remote branch;
- superseded task -> preserve unique work -> record supersession -> close PR -> explicitly retire branch when safe;
- abandoned task -> document abandonment -> close PR -> explicitly retire branch when safe;
- unresolved unique work -> keep branch and PR/recovery record until reconciled.

The rule is **not** "delete every old branch." The rule is "every branch has an explicit lifecycle state and no unique work is silently discarded."

## GitHub governance required on `main`

Repository code cannot fully substitute for GitHub branch governance. `main` should be protected by a ruleset that, at minimum:

- requires changes through pull requests;
- blocks force pushes and branch deletion;
- requires the repository's applicable validation checks;
- dismisses or re-evaluates stale integration state when the head changes;
- permits only the intended integration identity/bot to bypass, if any bypass is genuinely required.

Also enable automatic branch deletion after PR merge at the repository level when compatible with the worktree model. Studio still performs explicit remote cleanup so the lifecycle does not depend on that setting alone.

The `main-pr-gate-audit` workflow is a detection layer for bypasses. It cannot retroactively prevent a direct push; GitHub ruleset protection is the actual preventive control.

## Legacy branch recovery

For historical branch piles:

1. audit with `studio:lifecycle`;
2. delete only integrated managed branches first;
3. group closed-unmerged and orphan-unique branches by project/task/resource;
4. compare each group against current `main` and active PRs;
5. recover unique changes into a focused PR;
6. mark true supersession explicitly;
7. retire the obsolete remote branches only after preservation is proven.

This turns branch cleanup into convergence instead of data loss.
