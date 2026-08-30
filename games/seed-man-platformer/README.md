# Seed Man Platformer

The **Seed Man Platformer** is an original browser-game project using DTF Genetics' Seed Man mascot as the player character. The current playable level is **Seed Man: Sprout Run — Greenhouse Gauntlet** at `/games/seed-man-platformer/`.

## Character contract

The canonical mascot remains a short, chubby oval seed with a simple face, three-leaf sprout, rubber-hose limbs, white gloves/shoes, thick outline, and flat 2D treatment. Game animation may pose the character for movement while preserving the locked silhouette and identity.

The production browser route now uses an original Canvas2D vector character layer at `site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js`. It identifies itself as `seed-man-production-v1` and implements the locked `seed-man-locked-v1` character contract. The renderer is separate from gameplay simulation so visual iteration cannot silently alter collision or movement physics.

## Canonical implementation

- physics: `games/seed-man-platformer/src/physics.mjs`
- level data: `games/seed-man-platformer/data/level-01.json`
- metadata/release gates: `games/seed-man-platformer/game.json`
- browser acceptance: `games/seed-man-platformer/test/browser-smoke.mjs`
- production character art: `site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js`
- self-hosted production route source: `site/public-route-patch/games/seed-man-platformer/`
- public URL: `https://dtfseeds.com/games/seed-man-platformer/`

The canonical simulation and level-data copies must remain synchronized with the public route. The public browser runtime is intentionally self-contained and must not depend on runtime module imports or a runtime fetch for level data.

## Current playable scope

The expanded Sprout Run build includes:

- 7,800 px three-stage course — exactly 3× the original 2,600 px level width
- 24 required sprouts
- higher base jump and one true mid-air double jump per landing
- speed boost, high jump, sprout magnet, and hazard shield power-ups
- 7 power-up pickups total
- 3 progressive checkpoints
- 15 hazard zones
- gated finish that remains locked until all required sprouts are collected
- keyboard and touch controls
- JUMP ×2 mobile control
- pause, guarded restart, local personal best, falls/time tracking, active-power HUD, and course-progress rail
- keyboard focus ownership guard so gameplay controls do not break normal focused UI behavior
- production Seed Man Canvas2D vector art with run, idle, airborne, double-jump, hurt, checkpoint, and shield feedback states

## Validation

The dedicated workflow is `.github/workflows/seed-man-platformer-ci.yml` and runs:

```bash
node games/seed-man-platformer/test/physics.test.mjs
node games/seed-man-platformer/test/public-runtime.test.mjs
node games/seed-man-platformer/test/input-guard.test.mjs
node games/seed-man-platformer/test/browser-smoke.mjs
```

The browser acceptance covers desktop and mobile viewports and verifies keyboard/touch movement, normal and double jump, pause/resume, sprout collection, power-up collection, checkpoint respawn, the 24-sprout finish gate, finish/restart, production character-art execution, console errors, and mobile horizontal overflow.

Production verification is handled by `.github/workflows/seed-man-live-smoke.yml` plus `.github/workflows/seed-man-live-browser-acceptance.yml`. A live-success claim requires the cache-busted public route and required runtime assets to match the expanded 24-sprout build; an HTTP 200 by itself is not enough. The live smoke also requires the production character-art file and its version/contract markers.

## Current status

`browser-production-art`

The expanded level, gameplay systems, production character-art layer, automated desktop acceptance, and automated mobile-browser acceptance are established. The production art is original DTF Canvas2D work and does not use third-party character assets or level layouts.

Two human QA gates intentionally remain open until there is direct evidence for them:

- a hands-on physical-device mobile playtest
- a final visual consistency review of Seed Man in motion

Audio is currently optional and not a gameplay blocker. Do not mark the two human QA gates complete from static checks, HTTP smoke tests, or headless-browser automation alone.
