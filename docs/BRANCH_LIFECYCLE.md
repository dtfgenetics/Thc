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
6. If `main` moves while a PR is active, reconcile the same branch with current `main` and rerun exact-head validation. Do not create `-v2`, `-temp`, `-current`, or replacement branches merely to escape divergence.

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

The audit reports branch counts, lifecycle state, duplicate Studio task claims, safe cleanup candidates, and preserved recovery candidates.

Show only branches that may contain unique unmerged work:

```bash
node scripts/studio.mjs lifecycle --recovery-only
```

This mode returns only `closed-unmerged` and `orphan-unique` branches with their head SHA, update timestamp, PR references, and Studio session metadata when available. It never mutates remote refs.

Delete only provably integrated managed remote branches:

```bash
node scripts/studio.mjs lifecycle --cleanup-merged
```

This command does **not** delete closed-unmerged or orphan-unique branches.

Normal Studio integration also retires the merged managed remote branch after the exact validated head is merged, provided no other open PR still uses that branch.

## Explicit reviewed retirement

A closed-unmerged or orphan-unique branch can leave the recovery queue only after a human/agent review proves its unique behavior is already preserved on `main` or an explicit abandonment decision is recorded. Approved decisions live in `data/branch-retirements.json`.

Each approved retirement pins both:

- the **exact branch head SHA** that was reviewed; and
- a **superseding commit SHA** that must already be an ancestor of current `main`.

The destructive command is deliberately separate from lifecycle classification:

```bash
node scripts/studio/retire-reviewed.mjs --apply
```

A registered branch is deleted only when all of these remain true at execution time:

1. the remote branch still exists at the exact recorded head SHA;
2. the record status is `approved`;
3. no open pull request uses the branch;
4. the recorded superseding commit is already on current `main`;
5. the branch is not `main`.

If the branch head changed after review, deletion is blocked until the new head is reviewed. Missing branches are treated as already retired and are never recreated. Similar names, age, duplicate tips, and naming conventions are never substitutes for an explicit retirement record.

## Automatic maintenance and recovery inventory

`.github/workflows/branch-lifecycle-maintenance.yml` runs daily and whenever lifecycle controls or retirement records change. It performs three separate operations:

1. delete only managed branches already proven integrated;
2. delete only explicitly reviewed supersessions that still pass every fail-closed retirement guard;
3. rebuild a fresh, non-mutating recovery inventory after both cleanup phases.

Each run stores a 90-day artifact containing:

- `branch-lifecycle.json` — integrated cleanup decision/result;
- `reviewed-retirements.json` — explicit retirement decisions and safety checks;
- `branch-recovery.json` — machine-readable unique-work candidates after cleanup;
- `branch-recovery.csv` — sortable/filterable recovery queue;
- `branch-recovery.md` — human-readable queue.

The recovery inventory is the source for historical salvage work. Same names, similar names, duplicate commit tips, and old timestamps are evidence for prioritization only; they are never sufficient evidence for deletion.

## Merge-or-retire rule

A finished task must not leave a managed remote branch indefinitely:

- successful task -> validate -> merge exact PR head -> delete merged remote branch;
- superseded task -> prove current `main` preserves the needed work -> record the exact reviewed head and superseding commit -> explicitly retire;
- abandoned task -> document abandonment -> close PR -> record an explicit retirement decision -> retire only if the exact-head and no-open-PR guards still pass;
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

1. run automatic lifecycle cleanup first;
2. take the post-cleanup recovery artifact as the queue of potentially unique work;
3. prioritize recent branches and groups with closed PR references;
4. compare each candidate against current `main`, active PRs, and neighboring attempts for the same project/task;
5. recover unique changes into a focused current branch/PR when work is missing;
6. when work is already preserved, pin the exact old branch head plus the preserving `main` commit in `data/branch-retirements.json`;
7. let the fail-closed retirement command remove only reviewed entries that still match their recorded state.

This turns branch cleanup into convergence instead of data loss.
