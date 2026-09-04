---
name: dtf-parallel-studio
description: High-throughput coordination layer for many simultaneous chats, agents, projects, games, apps, content systems, assets, commerce changes, and releases across DTFSeeds. Use for new concurrent work in dtfgenetics/Thc and cross-repository DTFSeeds work that must remain independently buildable, testable, mergeable, and releasable. Optimize for speed: unique sessions, explicit resume, non-blocking overlap detection, affected-first validation, late integration against current main, and same-resource-only production serialization.
compatibility: Designed for OpenAI Codex, ChatGPT GitHub connector workflows, local Git worktrees, GitHub CLI, and other Agent Skills clients. GitHub remains the code/release authority; Google Drive remains the canonical rich asset/research/human-document source where the project registry says so.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Parallel Studio

DTFSeeds is one platform composed of many independently changeable resources. This skill lets many chats and agents work on those resources at the same time without turning the repository into one shared mutable workspace or one global release lock.

The goal is **more simultaneous work with fewer collisions and less unnecessary CI**.

## Speed contract

Default to optimistic parallel work.

- No global repository lock.
- No one-chat-at-a-time rule.
- Do not stop coding because another project is building, merging, or deploying.
- Do not merge current `main` into every working branch merely because `main` moved.
- Do not run the full repository for a local change unless an affected dependency requires it.
- Do not serialize unrelated production routes.
- Never silently reuse another chat's mutable branch.
- Yellow overlap is advisory, not a development stop.
- Coordination should cost less than the conflicts it prevents.

## Authority

Read current repository instructions and the subsystem-specific skill/source-of-truth documents.

Related skills:

- Repository repair/integration: `../github-repo-manager/SKILL.md`
- Existing legacy project/worktree flow: `../parallel-project-manager/SKILL.md`
- Live publication: `../dtfseeds-production-publishing/SKILL.md`
- Canonical content preservation: `../dtf-content-preservation/SKILL.md`

Use `data/project-registry.json` for project/source ownership and `data/studio-resources.json` for coordination resources.

Authority is field/resource specific:

- GitHub: code, tests, machine-readable release data, automation, deployment configuration.
- Drive: approved assets, research, print masters, human-readable source documents, and release packages when the project registry says so.
- WordPress/Hostinger: deployment targets, not automatically editing authority.
- A stale Drive note never overrides a newer locked repository architecture decision.

## One lightweight CLI

Studio intentionally does **not** add commands to root `package.json`, because that file is a shared CI hotspot. Use:

```bash
node scripts/studio.mjs <command> [...args]
```

Commands:

```text
new
resume
status
overlap
doctor
push
integrate
test
```

This keeps Studio evolution from unnecessarily triggering unrelated application workflows.

## Session model

New concurrent work gets a unique session:

```bash
node scripts/studio.mjs new <project-id> <task>
```

Local execution creates `work/<project-id>/<task>/<session-id>` in a dedicated linked worktree. A new session MUST NOT reconnect to an existing branch because its project/task text matches.

When only GitHub connector tools are available, reproduce the same model remotely: read current `main`, create a unique `work/.../<session>` branch from that exact SHA, edit only that branch, and create/update its PR. Do not claim a local worktree exists in connector-only execution.

Continuation is explicit:

```bash
node scripts/studio.mjs resume <work-branch>
node scripts/studio.mjs resume <pr-number>
```

Never turn `new` into implicit resume behavior.

## Resource model

Resources are data-driven and may represent code, UI, content, data, assets, APIs, commerce, routes, or future systems.

Examples:

```text
platform.site-shell
page.game-hub
game.high-land
game.weedopolis
app.growlens
app.grow-doc
app.plant-atlas
content.genetics
content.education
commerce.shop
```

One file may affect multiple resources. That is a dependency signal, not a reason to ban the edit.

## Fast work loop

1. Identify project and canonical source.
2. Start a unique Studio session.
3. Read the subsystem contract.
4. Make the focused change.
5. Run the narrowest trustworthy project/resource tests.
6. Inspect status/resources.
7. Push without synchronizing `main` into the session.
8. Keep working while other sessions proceed.
9. Check overlap before final integration.
10. Integrate the exact head against current `main` only at the final boundary.

Useful commands:

```bash
node scripts/studio.mjs status
node scripts/studio.mjs overlap
node scripts/studio.mjs doctor
node scripts/studio.mjs push
node scripts/studio.mjs integrate <pr-number>
```

## Status

`status` reports session identity, head, observed `main`, merge base, ahead/behind state, changed files, affected resources, and unmatched paths.

Being behind `main` is informational during development. Do not constantly rewrite the working branch just to appear current.

## Overlap model

### Green
No meaningful source/resource overlap. Continue normally.

### Yellow
Shared file, resource, contract, or production target detected without a proven integration conflict. Continue development; broaden affected validation when needed.

### Red
Current integration state actually conflicts on overlapping source/resources. Development may continue, but final integration requires semantic conflict repair.

Red is an integration condition, not a global repository freeze.

## Repository Doctor

Use:

```bash
node scripts/studio.mjs doctor
```

Doctor is read-only. It inspects active PRs and reports:

- GitHub-conflicting PRs;
- files touched by multiple PRs;
- resources touched by multiple PRs;
- exact production targets shared by multiple PRs;
- pairwise green/yellow/red overlap;
- possible supersession candidates;
- unclassified paths that should be added to the resource graph.

Doctor must not close PRs, move branches, merge code, or acquire locks. Its job is to make real conflicts visible quickly so agents can keep unrelated work moving.

## Production overlap is different

Mergeable branches may still target the same live route. Only the final writes for the same production resource should serialize.

Examples:

```text
route:/games/high-land/
route:/games/weedopolis/
route:/seeds/
route:/shop/
route:/thc-grow-doc/
```

High Land and Grow Doc should be able to publish concurrently when their workers are independent. Two High Land writers should queue only at the High Land production resource.

## Supersession

`overlap` and `doctor` may flag possible supersession when two PRs share the same resource and one changed-file set contains the other. This is advisory.

Before retiring an older PR:

1. confirm the newer work actually replaces it;
2. preserve any unique behavior/content;
3. record the supersession relationship;
4. only then close/retire the old PR.

Never delete work because a heuristic matched.

## Push without chasing main

Use:

```bash
node scripts/studio.mjs push
```

The push path must require a committed clean worktree, enforce the project lane, classify affected resources, push the exact session branch, create/reuse the PR, and NOT merge current `main` into the session merely to push.

The PR is the remote session handoff record.

## Late exact-head integration

Preflight:

```bash
node scripts/studio.mjs integrate <pr-number>
```

It must read the current PR head SHA, fetch current `main` and the PR branch, verify the fetched head still equals the expected PR head, calculate a non-destructive current-main merge using `git merge-tree` or equivalent, require current head checks, refuse stale-head integration, and avoid rewriting the working session.

Final merge:

```bash
node scripts/studio.mjs integrate <pr-number> --merge
```

Pin the merge to the exact validated head when the GitHub client supports it. If current `main` became incompatible, repair that integration conflict rather than restarting unrelated sessions.

## Testing philosophy

Use the smallest trustworthy validation set:

1. changed-function/unit tests;
2. project/resource tests;
3. build/type/lint for affected resource;
4. dependent-resource tests when a shared contract changed;
5. integration/e2e where user-visible or cross-resource behavior changed;
6. visitor/runtime verification after production publication.

A shared root file must not automatically mean every application needs its full browser suite. Prefer dependency-aware classification. Future affected-graph tooling such as Nx can automate this later; it is not a prerequisite for Studio v1.

## Cross-repository work

When a resource is canonical in another repository, develop/test there, produce an immutable source commit/artifact, update the DTFSeeds integration pin/contract in its own Studio session, validate the handoff, and publish only the affected DTFSeeds resource.

Do not copy mutable development trees between repositories as informal synchronization.

## Drive integration

Drive is a rich source plane, not the Git merge coordinator. When Drive input materially affects a release, capture stable provenance when practical: Drive file ID, reliable revision ID, modified timestamp, exported content hash for release-critical input, DTF project/resource ID, and approval/provenance state.

Do not scan all of Drive for every code change. Query it only when the affected resource consumes Drive-owned material.

## Shared files

Shared design systems, registries, lockfiles, deployment planners, workflows, and repository-control files are high-impact resources. Do not prohibit them. Classify them, expand affected checks, integrate late, and keep unrelated work moving.

Avoid adding Studio convenience commands to unrelated shared manifests when a dedicated dispatcher can provide the same speed with less CI fan-out.

## Current production architecture migration

The current gateway still has broad lanes such as `publicSuite` and one global production checkpoint. The target is independently buildable/releasable resources.

Migrate safely in verified slices:

1. session/resource isolation;
2. overlap/supersession analysis;
3. late exact-head integration;
4. affected-only testing/caching;
5. per-resource artifacts;
6. per-resource deployment concurrency;
7. per-resource production checkpoints.

Do not perform a destructive all-at-once production rewrite.

## Failure behavior

A failure is local until evidence proves it is global. One project's failure does not stop other projects from coding. One stale PR does not freeze the repo. One production route failure should not force unrelated routes to redeploy unless they truly share a release resource. One conflict gets repaired at integration. One stale Drive record gets flagged as drift instead of propagated.

Use `github-repo-manager` for actual conflicts, broken CI, rejected pushes, workflow failures, and repository repair.

## Completion states

Keep these distinct:

- **Development complete** — implementation and project tests complete.
- **Session pushed** — branch/PR exists remotely.
- **Integration ready** — exact head integrates with current `main` and checks pass.
- **Merged** — exact validated head entered `main`.
- **Published** — production writer completed.
- **Verified live** — visitor/runtime verification proved the intended production state.

Never collapse these into one generic "done" state.

## Final status format

Report session, affected resources, validation, overlap state, exact Git head/PR/integration state, production state, and only real remaining blockers or migrations.
