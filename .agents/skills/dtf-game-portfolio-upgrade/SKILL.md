---
name: dtf-game-portfolio-upgrade
description: Portfolio-wide audit, redesign, repair, and upgrade orchestration for all DTFSeeds games. Use when reviewing every game, identifying broken or low-quality systems, prioritizing visual/gameplay work, or coordinating shared capabilities across the catalog.
compatibility: Works with dtfgenetics/Thc and any related game repository or runtime that contributes to DTFSeeds.
metadata:
  author: dtfgenetics
  version: "2.0.0"
---

# DTF Game Portfolio Upgrade

Use this skill for portfolio-scale game work: audit what exists, identify broken or weak implementation, redesign where needed, and move individual titles toward production quality.

## Current development posture

Game code, repository ownership, visual direction, engine, backend, route, build tooling, deployment packaging, data shape, and implementation strategy are all editable. Existing source maps and documentation are useful for finding current work but do not prevent migration, consolidation, replacement, or rebuilds.

## Portfolio audit

For each title, determine:

1. intended player fantasy and core loop;
2. current code/runtime location;
3. visitor-facing route if one exists;
4. current gameplay, controls, visual, audio, mobile, accessibility, performance, and release quality;
5. stale, duplicated, broken, or conflicting code;
6. highest-value redesign or repair work;
7. assets and shared systems needed next;
8. best implementation path, including a rewrite when that is cleaner.

## Portfolio classes

Useful status labels include:

- `public-production`
- `public-playable`
- `development-release-candidate`
- `browser-vertical-slice`
- `prototype-not-promoted`
- `concept-only`

These are descriptive labels only and may change as work progresses.

## Quality dimensions

Score or evaluate:

1. gameplay clarity;
2. controls/input quality;
3. responsiveness/feel;
4. visual hierarchy/readability;
5. art/animation quality;
6. sound/feedback quality;
7. content/replay value;
8. accessibility/mobile/tablet usability;
9. performance/runtime health;
10. production/release reliability.

## Severity

Use P0/P1/P2/P3 to prioritize defects when helpful:

- P0: crash, data loss, route inaccessible, security/privacy defect, core loop cannot start/finish.
- P1: major controls/mobile/runtime failure, critical asset failure, unusable multiplayer.
- P2: confusing UX, weak feedback, visual inconsistency, incomplete quality.
- P3: polish and optional expansion.

This severity model helps order work; it does not prohibit broader redesign while blockers are being repaired.

## Shared systems

Build shared systems when they genuinely reduce duplicated engineering. Candidates include input mapping, audio/settings, replay/debug export, profiles/achievements, telemetry, content validators, asset manifests, accessibility preferences, multiplayer primitives, and live-route verification.

Shared code is optional. A game may use a bespoke system when that produces a better result.

## Visual review

Judge whether each game feels like a complete game rather than a web form or dashboard. Review:

- dominant board/world/stage/table/playfield;
- phone, tablet, laptop/desktop, and large-screen composition;
- HUD density and obstruction;
- interaction feedback and animation;
- character/card/environment quality;
- placeholder and rejected artwork;
- asset loading and runtime payload;
- title/menu/loading/results presentation.

Use the briefs under `docs/game-art/visual-rebuild/` as current design research and planning material. They are editable as the product direction develops.

## Implementation

After selecting work:

1. inspect enough of the existing source to understand what is useful and what is broken;
2. change, replace, move, consolidate, or rebuild the implementation needed for the goal;
3. remove obsolete code rather than stacking indefinite override layers;
4. update data and route/deployment metadata to match the new implementation;
5. run tests/build/browser/device checks appropriate to the resulting architecture;
6. verify the exact public route after deployment before describing it as live.

## Portfolio sequencing

Work may proceed in whatever order best advances the user-directed goal. Prioritize high-impact broken visuals, core gameplay failures, deployment disconnects, and reusable systems when that improves throughput, but do not require ownership, mechanics, art, or architecture to be locked before development begins.

## Re-audit

Reinspect the current code and live route whenever substantial work lands. Old scores, source maps, and design documents are historical evidence rather than permanent constraints.
