---
name: parallel-project-manager
description: Manage concurrent work in dtfgenetics/Thc without blocking releases or letting projects overwrite each other. Use when starting, continuing, pushing, integrating, or releasing one or more games, apps, education batches, infographics, website changes, or repository/platform tasks in parallel. Create isolated project worktrees and branches, use unrestricted multi/platform branches for intentional cross-project changes, validate the lane, and hand validated work to the existing automatic production gateway.
compatibility: Designed for OpenAI Codex and other Agent Skills clients with git/GitHub access in the dtfgenetics/Thc repository.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# Parallel Project Manager

Use this skill as the concurrency layer for `dtfgenetics/Thc`. Its purpose is to make it easy to work on many projects at once, push them independently, and move validated work toward production without introducing a global lock or manual approval bottleneck.

This skill does not replace the repository manager or production publisher. It decides how concurrent work is isolated and handed off:

- Repository repair/integration: `../github-repo-manager/SKILL.md`
- DTFSeeds live publishing: `../dtfseeds-production-publishing/SKILL.md`
- Parallel workflow details: `../../../docs/PARALLEL_PROJECT_WORKFLOW.md`

## Core contract

When a new repository task begins:

1. Identify the canonical project or platform owner.
2. Do not reuse a mutable checkout that is already serving another active task when a separate worktree can be used.
3. Use an isolated `project/<project-id>/<task>` branch for ordinary project work.
4. Use `multi/<task>` when the change intentionally spans multiple projects.
5. Use `project/platform/<task>` for repository-wide CI, deployment, routing, release, shared tooling, or integration work.
6. Preserve unrelated work and never reset another project's branch merely to simplify synchronization.
7. Run the relevant project tests plus the project-lane check before integration.
8. Push normally while iterating; use the live release path when the user asks to make the result live.
9. Allow other projects to continue while production is publishing. Do not invent a global development freeze.
10. Treat live-target serialization as automatic infrastructure behavior, not as a reason to stop creating, coding, testing, committing, or pushing other projects.

## Branch selection

### Ordinary isolated project

Use:

```text
project/<project-id>/<task>
```

Examples:

```text
project/high-land/mobile-ui
project/high-iq/question-pack
project/education/volume-18-batch-01
project/infographics/vpd-series
project/website/navigation-refresh
```

A normal project branch should primarily modify that project's canonical files plus shared tooling explicitly allowed by the lane configuration.

### Intentional multi-project work

Use:

```text
multi/<task>
```

This mode is intentionally unrestricted. Use it when one coherent change must span several games/apps/content systems, such as a game-hub migration, shared navigation change, repository-wide dependency migration, or coordinated release repair.

Do not split a genuinely atomic cross-project change into artificial isolated branches just to satisfy a naming convention.

### Platform and integration work

Use:

```text
project/platform/<task>
```

This mode is also intentionally unrestricted. Use it for CI, deployment routing, production coordinators, repository architecture, shared automation, release infrastructure, and other platform-level changes.

### Legacy/in-flight work

Existing branches remain valid. Do not abandon, rename, or rewrite active work solely to adopt this skill. Apply the isolation model to new work and use current repository instructions to integrate older branches safely.

## Starting work

Preferred command from the primary repository checkout:

```bash
npm run project:new -- <project-id> <task>
```

For intentional multi-project work:

```bash
npm run project:new -- platform <task> --multi
```

The helper creates a sibling worktree from current `origin/main` and the appropriate branch name.

If the helper cannot be used but git access exists, reproduce its intent manually: fetch current `main`, create a focused branch from that exact head, and put it in a separate worktree/check-out location that is not being mutated by another active project.

## During development

- Stay inside the project's canonical source unless the task explicitly needs shared/platform changes.
- Read the subsystem-specific skill and source-of-truth documentation before editing.
- Do not use one project's build output as another project's source.
- Do not delete or rewrite unrelated files because they appear stale in the current worktree.
- Commit coherent changes so another project can merge independently.
- Keep generated assets tied to their canonical source/generator when the repository provides one.

If new evidence shows the task genuinely spans several projects, move the work to an intentional `multi/*` or `project/platform/*` lane rather than weakening isolation checks globally.

## Validation

Before pushing or opening a PR, run:

```bash
npm run project:check
```

For infrastructure changes to this system, also run:

```bash
npm run project:test
```

Then run the subsystem's own tests/build/lint/type/e2e checks required by its skill or documentation.

A lane failure means the branch touched files inconsistent with its declared project scope. Fix the scope or use an intentional multi/platform branch when the cross-project change is legitimate. Do not disable the validator just to make a branch pass.

## Push and review flow

While iterating:

```bash
npm run project:push
```

Expected behavior:

1. Require a clean worktree.
2. Fetch latest `main`.
3. Bring current `origin/main` into the project branch when necessary without discarding branch work.
4. Validate project scope.
5. Push the branch.
6. Create or reuse a pull request when supported.

A pushed branch is not production and is not a completed live request.

## One-command live flow

When the user explicitly wants the change live and the repository helper is available:

```bash
npm run project:live
```

Expected behavior:

1. Perform the same synchronization and lane validation as `project:push`.
2. Push/create the PR.
3. Follow applicable checks for the exact PR head.
4. Merge only the validated current head.
5. Hand the resulting `main` revision to the existing DTFSeeds production gateway.
6. Follow the production-publishing skill for the affected route/lane.
7. Do not claim live success until visitor-facing verification succeeds.

If `project:live` fails, inspect the exact failing stage. Do not bypass the normal production gateway with an ad-hoc deploy unless the production skill explicitly defines that recovery path.

## Rapid merge behavior

The DTFSeeds production gateway plans automatic releases from the `dtfseeds-production` checkpoint, which represents the newest commit whose planned production lanes were actually published and visitor-verified successfully.

Therefore:

- several branches may merge rapidly;
- GitHub may supersede intermediate queued gateway runs;
- the newest current run must include all production-owned changes since the last successful checkpoint;
- a stale or superseded run must not advance the checkpoint;
- no earlier validated project should disappear merely because a later project merged before its queued deployment started.

Do not redesign this into "deploy only the immediately previous commit" behavior.

## Concurrency policy

Development is parallel by default.

The following may proceed simultaneously:

- project worktrees;
- feature/content branches;
- tests and builds;
- pull requests;
- game development;
- education production;
- infographic production;
- application work;
- website work.

Only operations that mutate the same live production resource may be serialized automatically. For example, two writers targeting the same live WordPress surface should not overwrite each other concurrently.

That serialization must remain automatic and narrow. It must not become:

- a global repository lock;
- a one-project-at-a-time policy;
- a manual approval gate for ordinary releases;
- a requirement to stop coding while another deployment runs;
- a reason to reject legitimate `multi/*` or `project/platform/*` changes.

## Conflict handling

When latest `main` moved while a project was being developed:

1. Fetch the newest destination state.
2. Read the exact overlapping files before resolving.
3. Preserve compatible changes from both sides.
4. Never use blanket `ours`/`theirs` conflict resolution.
5. Re-run project and subsystem validation after the resolution.
6. Verify the PR head SHA immediately before merge when concurrent work is active.

If the conflict represents a real product decision rather than mechanical source divergence, follow the repository-manager skill instead of guessing.

## Failure escalation

Use `../github-repo-manager/SKILL.md` when any of these occur:

- merge conflict;
- branch divergence;
- failed CI;
- rejected push;
- dependency/build failure;
- broken workflow;
- production gateway failure requiring repository repair.

Use `../dtfseeds-production-publishing/SKILL.md` once repository integration is complete and the user requested a live DTFSeeds change.

A failed check is not permission to remove concurrency safety. Diagnose the failure and fix its root cause.

## Completion gate

For a normal parallel project task, do not report completion until the applicable items are true:

- [ ] Correct project/platform owner identified.
- [ ] Correct branch mode selected: isolated, multi, platform, or preserved legacy.
- [ ] Work is isolated from unrelated active projects.
- [ ] Repository/subsystem instructions were read.
- [ ] Canonical source was changed.
- [ ] Relevant subsystem tests passed.
- [ ] `npm run project:check` passed for new project/multi branches when available.
- [ ] `npm run project:test` passed when changing parallel/release infrastructure.
- [ ] Latest `main` was integrated without discarding concurrent work.
- [ ] PR/merge used the exact validated head.
- [ ] Production handoff was followed when live publication was requested.
- [ ] Visitor-facing verification passed before claiming the result live.

## Final status format

Keep reports compact and distinguish:

- **Project lane:** branch/worktree and whether it is isolated, multi, or platform.
- **Changed:** project/source areas modified.
- **Validation:** lane check plus subsystem checks.
- **Git state:** commit/PR/merge state.
- **Production:** not requested, queued/in progress, published but not verified, or verified live.
- **Remaining:** only genuine blockers or unverified states.
