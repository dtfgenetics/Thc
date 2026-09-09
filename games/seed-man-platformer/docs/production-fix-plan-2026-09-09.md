# Seed Man Run production fix plan — 2026-09-09

This file tracks the current production hardening work for the canonical v20 Seed Man Platformer.

## Priority order

1. Enforce approved Seed Man art as the only production character path.
2. Remove or isolate legacy 11/15-level runtime imports from the v20 public route.
3. Verify the public route boots the canonical 20-level campaign and v20 UI/runtime.
4. Validate required approved-art manifest keys and fail loudly when production assets are missing.
5. Keep simulation/gameplay ownership separate from rendering and presentation.
6. Verify phenotype forms (Plant, Fire, Electric, Ice), bosses, save/progression, and level continuity through deterministic tests.
7. Verify the generated public bundle matches source-of-truth metadata before deployment.
8. Expand production art coverage for Seed Man states, phenotype forms, enemies, bosses, world tiles/backgrounds, HUD, VFX, and audio.

## Non-negotiable release gates

- 20 contiguous levels across five worlds.
- Approved green armored Seed Man only; no brown-seed, procedural, or legacy atlas fallback in production.
- Plant is permanent base form; Fire, Electric, and Ice are temporary 30-second phenotype forms.
- Six bosses mapped to their canonical campaign encounters, including Blight King at Level 20.
- No legacy v15 files may define level count, world identity, boss identity, UI copy, release readiness, or deployment metadata.
- Public route and generated bundle must resolve the same v20 production contract.
- Deterministic Node/build validation is required; Playwright is not part of this workflow.

## Next implementation passes

### Pass A — Runtime ownership
- Audit public route script imports.
- Remove any legacy script that can override v20 campaign/UI/runtime state.
- Add explicit boot/version assertions for v20.

### Pass B — Visual runtime
- Verify every approved character state is present: idle, walk, run, jump, fall, land, attack, hit, victory.
- Verify Plant/Fire/Electric/Ice form mappings use the same canonical Seed Man identity.
- Verify enemies, bosses, platforms, world art, HUD and VFX resolve only through stable manifest keys.

### Pass C — Campaign and gameplay
- Validate all 20 levels, five world mappings, checkpoints, bosses and finale progression.
- Validate phenotype drops and 30-second timers.
- Validate save/load and migration behavior.

### Pass D — Release
- Build the public Three.js bundle.
- Run production-contract tests.
- Run v20 source/bundle verification.
- Run public-route/deployment verification.
- Reconcile deployment metadata and remove obsolete compatibility writers once no longer imported.
