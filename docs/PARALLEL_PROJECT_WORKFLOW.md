# Parallel Project Workflow

This repository supports many games, applications, education batches, infographics, and website changes being developed at the same time without sharing one mutable checkout or losing a release when `main` moves quickly.

## Design goals

- Do not limit how many projects can be worked on at once.
- Do not require a manual release approval just because work is parallel.
- Keep each normal project in its own Git branch and worktree so uncommitted files, generated assets, dependency installs, and branch switching cannot overwrite another project's work.
- Allow intentional cross-project work without fighting the guardrail.
- Keep production publication automatic after a validated merge to `main`.
- Serialize only mutations that actually share the same live WordPress production surface.
- Never lose an earlier project's deployment when several branches merge rapidly.

## Branch modes

### Normal isolated project

Use:

```text
project/<project-id>/<task>
```

Examples:

```text
project/high-iq/question-ui
project/high-land/multiplayer-lobby
project/education/volume-17-batch-01
project/infographics/vpd-series
project/website/mobile-navigation
```

The project-lane check protects canonical project code from accidental edits to another project's code. Shared repository tooling and documentation remain available.

### Intentional multi-project work

Use:

```text
multi/<task>
```

This branch type is intentionally unrestricted. Use it when one change must update several projects together, such as a game-hub integration or repository-wide migration.

### Platform/integration work

Use:

```text
project/platform/<task>
```

This branch type is also intentionally unrestricted. It is for repository architecture, CI, deployment routing, shared build systems, and other integration work.

### Existing/legacy branches

Existing branch names remain compatible. The lane validator is advisory for branches that do not use the new naming convention, so in-flight work is not broken by this system.

## Create an isolated worktree

From the primary repository checkout:

```bash
npm run project:new -- high-iq question-ui
npm run project:new -- high-land multiplayer-lobby
npm run project:new -- education volume-17-batch-01
npm run project:new -- infographics vpd-series
```

The command creates a sibling worktree under `Thc-worktrees/` and a branch named `project/<id>/<task>` from current `origin/main`.

For intentional multi-project work:

```bash
npm run project:new -- platform game-hub-refresh --multi
```

That creates `multi/game-hub-refresh`.

Each coding agent/session should operate in one worktree. A second project gets a second worktree rather than switching the first checkout to another branch.

## Validate before pushing

```bash
npm run project:check
npm run project:test
```

`project:check` validates the current branch's changed paths. `project:test` verifies the isolation rules and the lossless production checkpoint planner itself.

## Push a project

```bash
npm run project:push
```

This command:

1. verifies the worktree is clean;
2. fetches the latest `main`;
3. merges current `origin/main` into the project branch when needed;
4. runs the project-lane validator;
5. pushes the branch;
6. creates a pull request when GitHub CLI is available.

It does not merge by default, which makes it useful while a project is still being reviewed or iterated.

## Push through to production

```bash
npm run project:live
```

This performs the same preparation, pushes/creates the PR, waits for PR checks, and merges the validated PR to `main`. The existing DTFSeeds production gateway then automatically identifies and publishes the affected production lane(s).

A merge is still not considered live until the production workflow's visitor-facing verification succeeds.

## Why rapid merges no longer lose releases

The production gateway uses the lightweight Git tag:

```text
dtfseeds-production
```

That tag points to the newest commit whose planned production lanes were actually published and visitor-verified successfully.

Automatic release planning compares that checkpoint with the current `main`, not merely the immediately previous push. Therefore, if GitHub supersedes intermediate queued gateway runs while five projects merge quickly, the final current run sees the union of every production-owned file changed since the last successful deployment.

The checkpoint advances only after a current production run passes authoritative lane enforcement. A stale/superseded run cannot advance it.

## Production concurrency

Development is parallel. Production mutation is target-safe.

Multiple branches, worktrees, tests, builds, content batches, and PRs can exist simultaneously. The production coordinator may serialize writes that share the same live WordPress surface because allowing two writers to overwrite the same live files at the same moment is a data-loss risk, not a useful form of parallelism.

This serialization is automatic. It does not require the developer to stop working, close another project, or wait before creating/pushing more branches.

## Recommended agent behavior

When an AI coding agent receives a new project task:

1. resolve the canonical project owner;
2. use/create the project's worktree instead of switching a checkout already used by another task;
3. use `project/<id>/<task>` for ordinary work;
4. use `multi/<task>` or `project/platform/<task>` when cross-project changes are intentional;
5. add code/content/tests normally;
6. run the project's own tests plus `npm run project:check`;
7. use `npm run project:push` while iterating or `npm run project:live` when the change should proceed through merge and automatic production publication.

There is no fixed limit on the number of active project worktrees.
