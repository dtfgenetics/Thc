---
name: dtf-parallel-studio
description: High-throughput coordination layer for many simultaneous chats, agents, projects, games, apps, content systems, assets, commerce changes, and production releases across DTFSeeds. Use for all new concurrent work in dtfgenetics/Thc and for cross-repository DTFSeeds work that must remain independently buildable, testable, mergeable, and releasable. Optimize for speed: create unique sessions, avoid implicit branch reuse, detect overlap without blocking development, validate only affected resources first, integrate against current main late, and serialize only identical production resources.
compatibility: Designed for OpenAI Codex, ChatGPT GitHub connector workflows, local Git worktrees, GitHub CLI, and other Agent Skills clients. GitHub remains the code/release authority; Google Drive remains the canonical rich asset/research/human-document source where the project registry says so.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Parallel Studio

This skill is the high-throughput coordination layer for DTFSeeds. It exists because many chats and agents are building parts of the same larger product, `dtfseeds.com`, and must be able to move quickly without turning every project into one shared mutable branch or one monolithic release.

The goal is **more simultaneous work with fewer collisions**, not more process.

## Speed contract

Default behavior is optimistic and parallel.

- Do not create a global repository lock.
- Do not create a one-chat-at-a-time rule.
- Do not block coding because another project is building, testing, merging, or deploying.
- Do not merge current `main` into every working branch merely because `main` moved.
- Do not require full-repository testing for a local change unless the affected graph or a shared contract requires it.
- Do not serialize unrelated production routes.
- Do not silently reuse another chat's mutable branch.
- Do not treat a warning about overlap as a reason to stop development.
- Do not make Drive, GitHub, WordPress, Hostinger, or any other system a second competing source of truth for the same field.

Coordination should cost less than the conflicts it prevents.

## Authority and related skills

Read current repository instructions first.

For repository integration/failures, use:

- `../github-repo-manager/SKILL.md`

For existing project/worktree compatibility rules, use:

- `../parallel-project-manager/SKILL.md`

For live DTFSeeds publication, use:

- `../dtfseeds-production-publishing/SKILL.md`

For canonical content preservation, use:

- `../dtf-content-preservation/SKILL.md`

This skill does not replace subsystem skills. It decides **how concurrent work is isolated, observed, integrated, and handed to the correct release owner**.

## Source-of-truth model

Use `data/project-registry.json` as the cross-project ownership map.

Use `data/studio-resources.json` as the coordination/resource map.

Important distinction:

- GitHub is canonical for code, tests, machine-readable release data, automation, and deployment configuration.
- Drive may be canonical for approved assets, research, print masters, human-readable source documents, and release packages when the project registry says so.
- Production WordPress/Hostinger state is a deployment target, not automatically the canonical editing source.
- A stale Drive note does not override a newer locked repository architecture decision.

When sources disagree, resolve authority at the field/resource level before propagating the value.

## Session model

### New work

Every new concurrent task gets a unique session.

Preferred local command:

```bash
npm run studio:new -- <project-id> <task>
```

This creates:

```text
work/<project-id>/<task>/<session-id>
```

in an isolated linked worktree.

A new session MUST NOT attach to an existing branch simply because the project/task text matches.

### Explicit continuation

Resume only when continuation is intentional:

```bash
npm run studio:resume -- <work-branch>
```

or:

```bash
npm run studio:resume -- <pr-number>
```

Never turn `studio:new` into an implicit resume operation.

### Connector-only execution

When a local worktree is unavailable but GitHub branch tools are available:

1. read current `main` SHA;
2. create a unique `work/<project>/<task>/<session>` branch from that exact SHA;
3. edit only that branch;
4. create/update a PR for the session;
5. preserve the same session/resource metadata in the PR body when practical.

Do not claim a local worktree exists when operating only through a remote connector.

## Resource model

DTFSeeds is one platform composed of independently changeable resources.

Examples:

```text
page.game-hub
platform.site-shell
game.high-land
game.high-iq
app.growlens
app.grow-doc
app.plant-atlas
content.genetics
content.education
commerce.shop
```

Resources are data-driven. New project types should be registered rather than requiring a rewrite of this skill.

One file may legitimately affect multiple resources. For example, a shared design-system file can affect both a shared UI resource and Genetics. That is a dependency signal, not a reason to ban the change.

## Fast work loop

For normal development:

1. identify project and canonical source;
2. start a unique studio session;
3. read the subsystem skill/source-of-truth docs;
4. make the focused change;
5. run narrow project/resource tests first;
6. inspect session/resource state;
7. push without merging `main` into the session;
8. keep working while other sessions proceed;
9. evaluate overlap before final integration;
10. integrate the exact head against current `main` at the final boundary.

Useful commands:

```bash
npm run studio:status
npm run studio:overlap
npm run studio:push
npm run studio:integrate -- <pr-number>
```

## Status is informational during development

`studio:status` reports:

- session identity;
- current head;
- observed `main`;
- ahead/behind information;
- changed files;
- affected resources;
- unmatched files.

Being behind `main` is NOT by itself a development failure.

Do not constantly rewrite a working branch to keep it visually current with `main`.

## Overlap model

Use three development states:

### Green

No meaningful source/resource overlap.

Action: continue normally.

### Yellow

Shared files, resources, contracts, or production target detected, but no proven integration conflict.

Action: continue development. Expand affected validation before merge if the shared dependency requires it.

### Red

The current integration state is actually conflicting for overlapping source/resources.

Action: development may continue, but final integration requires semantic conflict repair against current `main`.

Red is an integration condition, not a global stop signal.

## Production overlap is separate from development overlap

Two branches can be perfectly mergeable yet target the same live route.

That is not a reason to stop coding.

Only final production mutations for the same resource should serialize.

Examples:

```text
route:/games/high-land/
route:/games/weedopolis/
route:/seeds/
route:/shop/
route:/thc-grow-doc/
```

High Land and Grow Doc should be allowed to publish concurrently if their production workers are independent.

Two High Land writers should queue at the High Land production resource.

## Supersession

Multiple open PRs may represent the same repair forward-ported after `main` moved.

`studio:overlap` can flag a possible supersession when branches share the same resource and one changed-file set contains the other.

Supersession detection is advisory until intent is confirmed by source/history/PR context.

Do not automatically delete or close work solely because a heuristic matched.

When a newer PR clearly supersedes an older stale PR:

- record the relationship;
- preserve any unique behavior from the older PR;
- close/retire the older PR only after confirming nothing unique is lost.

## Push behavior

Use:

```bash
npm run studio:push
```

The push path must:

1. require a clean committed worktree;
2. enforce the project lane;
3. classify affected resources;
4. push the exact session branch;
5. create/reuse its PR;
6. NOT merge current `main` into the session merely to push.

The PR is the remote handoff record for the session.

## Late integration

Use:

```bash
npm run studio:integrate -- <pr-number>
```

The integration preflight must:

1. read the current PR head SHA;
2. fetch current `main`;
3. verify the fetched PR branch still equals the expected head SHA;
4. calculate a non-destructive merge against current `main` using `git merge-tree` or equivalent;
5. require checks for the exact head;
6. refuse stale-head integration;
7. avoid rewriting the working session.

To perform the final merge when ready:

```bash
npm run studio:integrate -- <pr-number> --merge
```

The merge must be pinned to the exact validated head when the available GitHub client supports it.

If the target moved incompatibly, repair that integration conflict; do not restart unrelated sessions.

## Testing philosophy

Optimize for the smallest trustworthy validation set.

Order:

1. changed-function/unit test;
2. project/resource tests;
3. build/type/lint for the affected resource;
4. dependent-resource tests when a shared contract changed;
5. integration/e2e tests where user-visible or cross-resource behavior changed;
6. production visitor/runtime verification after publication.

Future affected-graph tooling such as Nx may automate steps 2-4. Do not require that migration before using this skill.

## Cross-repository work

Some DTF resources are canonical in dedicated repositories and only integrated into `Thc` through pinned source revisions or packaging contracts.

Examples include external games and Grow Doc source data.

For a dedicated repo:

1. develop/test/release in the canonical repo;
2. produce an immutable source commit/artifact;
3. update the DTFSeeds integration pin/contract in its own studio session;
4. validate the handoff;
5. publish only the affected DTFSeeds resource.

Do not copy mutable development trees between repos as an informal synchronization mechanism.

## Drive integration

Drive is a rich source plane, not the Git merge coordinator.

When Drive input materially affects a release, capture stable provenance when practical:

- Drive file ID;
- relevant revision ID when reliable;
- modified timestamp;
- exported content hash for release-critical input;
- DTF project/resource ID;
- approval/provenance state.

Do not scan the entire Drive on every code change.

Use Drive only when the affected resource consumes Drive-owned material.

## Shared files

Files under repository control, shared design systems, lockfiles, deployment planners, registries, and workflow infrastructure are high-impact shared resources.

Treat edits to them as potentially broader affected changes.

Do not solve this by prohibiting them from normal work. Instead:

- classify them;
- run broader affected checks;
- integrate late;
- keep unrelated development moving.

## Current architecture limitation to remove incrementally

The existing production gateway still contains broad lanes such as `publicSuite` and a global production checkpoint.

This skill's target architecture is per-resource build/release/checkpoint state.

Do not perform a destructive all-at-once deployment rewrite merely to conform to the target model.

Migrate safely in slices:

1. resource/session isolation;
2. overlap/supersession analysis;
3. late exact-head integration;
4. affected-only testing/caching;
5. per-resource artifacts;
6. per-resource deployment concurrency;
7. per-resource production checkpoints.

Each slice must preserve current production behavior until its replacement is verified.

## Failure behavior

A failure is local until evidence proves it is global.

- One project's unit failure should not block another project from coding.
- One stale PR should not freeze the repo.
- One production route failure should not force unrelated routes to redeploy unless they share a dependency or release worker.
- One conflict should be repaired semantically at integration.
- One outdated Drive record should be flagged as drift, not propagated automatically.

Use `github-repo-manager` for actual merge conflicts, broken CI, rejected pushes, workflow failures, and repository repair.

## Completion states

Always distinguish:

- **Development complete:** project change implemented and project tests pass.
- **Session pushed:** branch/PR exists remotely.
- **Integration ready:** exact head integrates with current main and checks pass.
- **Merged:** exact validated head entered main.
- **Published:** production writer completed.
- **Verified live:** visitor/runtime verification proved the intended result.

Never collapse those states into one "done" claim.

## Final reporting format

Keep reports compact:

- **Session:** project/task/session branch.
- **Resources:** affected resource IDs.
- **Validation:** narrow/affected checks run.
- **Overlap:** green/yellow/red plus any same-production target.
- **Git:** head/PR/integration state.
- **Production:** not requested, queued, published-unverified, or verified live.
- **Remaining:** only real blockers, dependency migrations, or unverified state.
