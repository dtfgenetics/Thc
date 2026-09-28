# Repository Archive Readiness

Date: 2026-09-28

This file tracks repositories that are safe to retire versus repositories that merely look old or small.

## Ready after external-reference check

### `dtfgenetics/code`

Status: **archive candidate**

Evidence:
- repository reports size `0`;
- GitHub tree API reports the repository is empty;
- no canonical product responsibility is assigned.

Remaining blocker:
- confirm no external automation, documentation, bookmark, or deployment target still references the repository name.

No code/content migration is required.

### `dtfgenetics/thc-music-bot-for-discod`

Status: **archive candidate**

Evidence:
- repository README explicitly identifies it as a duplicate/compatibility pointer;
- canonical implementation is `dtfgenetics/thc-discord-bot-for-music-`;
- duplicate repository has no separate package/runtime.

Remaining blocker:
- update old links/issues/docs that still point at the misspelled duplicate repository.

No code migration is required.

## Ready after current migration PR lands

### `dtfgenetics/all-in-one-thc-grow-`

Status: **migration**

Evidence:
- README explicitly states it is a legacy placeholder / merge candidate / not deployable;
- no application exists in the repository;
- product responsibilities already resolve to `Thc`, `Tools`, `thc-grow-hub`, and `Thc-dataset`;
- only significant retained artifact found is `docs/EVIDENCE_REFERENCE_REGISTRY.md`.

Migration:
- evidence registry moved to canonical `dtfgenetics/Tools` in Tools PR #13.

Remaining blockers:
1. merge Tools PR #13;
2. update references to the legacy evidence-registry path;
3. check non-default branches/history for unique content;
4. then change repository status to `archive_candidate`.

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

The source-level review now shows:
- Grow Doc canonical source: `Thc-dataset`;
- High Land canonical source: `Thc`;
- High IQ canonical source: `Thc`;
- shared game platform canonical source: `Thc/games/shared-platform`;
- production deployment authority: `Thc`.

The remaining work is mostly asset/provenance/shared-UI decomposition plus final non-default-branch/history review. Do not archive until those checks are complete.

### `dtfgenetics/Dtf420`

Controlled migration/cutover candidate. Keep until an explicit platform cutover decision is made. It must not receive competing canonical implementations in the meantime.

## Archive operation note

The connected GitHub toolset used for this cleanup does not expose the repository setting that toggles GitHub's archived state. Therefore this register distinguishes **verified archive-ready** from **actually archived**. Do not report a repository as archived until GitHub metadata confirms `archived: true`.
