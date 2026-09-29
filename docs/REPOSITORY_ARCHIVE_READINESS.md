# Repository Archive Readiness

Date: 2026-09-29

This file tracks repositories that are safe to retire versus repositories that merely look old or small. The machine-readable authority is `data/repository-registry.json`.

## Verified archive-ready

### `dtfgenetics/code`

Status: **archive ready**

Evidence:
- repository size is `0`;
- repository has no branches/content;
- no canonical product responsibility is assigned.

No code/content migration is required. Archive rather than delete so repository history/identity remains preserved.

### `dtfgenetics/thc-music-bot-for-discod`

Status: **archive ready**

Evidence:
- repository is a README-only duplicate/compatibility pointer;
- canonical implementation is `dtfgenetics/thc-discord-bot-for-music-`;
- duplicate repository has no package/runtime and no alternate branches.

No code migration is required. Archive rather than delete.

### `dtfgenetics/all-in-one-thc-grow-`

Status: **archive ready**

Evidence:
- no deployable application remains;
- product responsibilities already resolve to `Thc`, `Tools`, `thc-grow-hub`, and `Thc-dataset`;
- the retained evidence registry was migrated to canonical `dtfgenetics/Tools` and merged in Tools PR #13;
- the only non-main branch, `docs/archive-ready`, compares at `ahead_by: 0` against current `main`.

Archive rather than delete so Git history remains available.

## Not archive candidates

### `dtfgenetics/Happy-seed-story-s-`

Status: **standalone canonical**

This is a real publishing project, not leftover site code. It owns the Happy Seed Stories / Seed Valley manuscript, art, education, research, quality-control, and publishing system.

### `dtfgenetics/Video-photo-editing-and-communications-posting-`

Status: **standalone canonical**

This is the Creator Engine / THC Content Engine: an independent local-first media production and packaging product with schemas, tests, recipes, plugins, and its own implementation roadmap.

### `dtfgenetics/thc-discord-bot-for-music-`

Status: **standalone canonical**

This is the active DTF/THC Discord music bot. It owns the runtime, per-server queue, URL policy, tests, CI, and environment contract.

## Still migration, not archive-ready

### `dtfgenetics/dtf-thc-hub`

The source-level review shows canonical ownership has moved elsewhere, but the repository still contains unique legacy/integration material and divergent branches. Preserve it until those items are reconciled.

Current rules:
- production deployment authority: `dtfgenetics/Thc`;
- cultivation tools: `dtfgenetics/Tools`;
- education: `dtfgenetics/thc-grow-hub`;
- certification: `dtfgenetics/Thc-learning-courses-`;
- Grow Doc diagnostics: `dtfgenetics/Thc-dataset`.

Do not archive until unique assets, shared UI, deployment safeguards, game changes, and divergent branches have been reconciled.

### `dtfgenetics/Dtf420`

Controlled migration/cutover candidate. Keep until an explicit platform cutover decision is made. It must not receive competing canonical implementations in the meantime.

## Archive operation note

The connected GitHub toolset used for this cleanup does not expose the repository setting that toggles GitHub's archived state. Therefore this register distinguishes **verified archive-ready** from **actually archived**. Do not report a repository as archived until GitHub metadata confirms `archived: true`.
