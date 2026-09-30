# Repository Archive Readiness

Date: 2026-09-29

This file tracks repositories that are safe to retire versus repositories that merely look old or small.

## Verified archive-ready

### `dtfgenetics/code`

Status: **archive ready**

Evidence:
- repository reports size `0`;
- GitHub tree API reports the repository is empty;
- no canonical product responsibility is assigned.

No code/content migration is required. Archive rather than delete so repository history remains available.

### `dtfgenetics/thc-music-bot-for-discod`

Status: **archive ready**

Evidence:
- repository README explicitly identifies it as a duplicate/compatibility pointer;
- canonical implementation is `dtfgenetics/thc-discord-bot-for-music-`;
- duplicate repository has no separate package/runtime.

No code migration is required. Archive rather than delete.

### `dtfgenetics/all-in-one-thc-grow-`

Status: **archive ready**

Evidence:
- README explicitly states it is a legacy placeholder / merge candidate / not deployable;
- no application exists in the repository;
- product responsibilities already resolve to `Thc`, `Tools`, `thc-grow-hub`, and `Thc-dataset`;
- only significant retained artifact found is `docs/EVIDENCE_REFERENCE_REGISTRY.md`.

Migration:
- evidence registry moved to canonical `dtfgenetics/Tools` and merged in Tools PR #13.

Verification complete:
- the evidence registry was migrated to `dtfgenetics/Tools`;
- the only non-main branch, `docs/archive-ready`, is `ahead_by: 0` against current `main`.

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

The source-level review now shows:
- Grow Doc canonical source: `Thc-dataset`;
- High Land canonical source: `Thc`;
- High IQ canonical source: `Thc`;
- shared game platform canonical source: `Thc/games/shared-platform`;
- production deployment authority: `Thc`.

The remaining work is asset/provenance/shared-UI decomposition plus non-default-branch/history review. A SHA-level asset comparison found unique legacy High Land source sheets and brand/UI SVGs, and at least three non-default branches are ahead of `main`. See `docs/LEGACY_ASSET_PROVENANCE_HOLD.md` and `docs/LEGACY_REPOSITORY_MIGRATION.md`. Do not archive until those checks are complete.

### `dtfgenetics/Dtf420`

Controlled migration/cutover candidate. Keep until an explicit platform cutover decision is made. It must not receive competing canonical implementations in the meantime.

## Active-tree retention policy

Retired implementation payloads should not remain in an active repository solely so CI can prove they once existed.

The canonical retention rule is now:

- Git history preserves retired file contents and commit lineage.
- `docs/archive/retention-manifest.json` preserves the explicit retirement decision, retired paths, canonical successor, and reintroduction policy.
- CI must reject a retired path if it reappears in the active tree.
- Historical release notes, provenance records, and migration decisions may remain when they still explain current architecture or ownership.
- Executable scripts, workflows, deploy payloads, generated bundles, and duplicate runtime data should be removed once they are superseded and no active dependency requires them.

This reduces active-tree clutter without destroying provenance.

## Archive operation note

The connected GitHub toolset used for this cleanup does not expose the repository setting that toggles GitHub's archived state. Therefore this register distinguishes **verified archive-ready** from **actually archived**. Do not report a repository as archived until GitHub metadata confirms `archived: true`.
