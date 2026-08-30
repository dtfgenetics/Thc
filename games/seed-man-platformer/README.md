# Seed Man Platformer

The **Seed Man Platformer** is an original browser-game project using DTF Genetics' Seed Man mascot as the player character. The current playable level is **Seed Man: Sprout Run — Greenhouse Gauntlet** at `/games/seed-man-platformer/`.

## Character contract

The canonical mascot remains a short, chubby oval seed with a simple face, three-leaf sprout, rubber-hose limbs, white gloves/shoes, thick outline, and flat 2D treatment. Game animation may pose the character for movement while preserving the locked silhouette and identity.

## Canonical implementation

- physics: `games/seed-man-platformer/src/physics.mjs`
- level data: `games/seed-man-platformer/data/level-01.json`
- metadata/release gates: `games/seed-man-platformer/game.json`
- tests: `games/seed-man-platformer/test/`
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

## Validation

The dedicated workflow is `.github/workflows/seed-man-platformer-ci.yml` and must run:

```bash
node games/seed-man-platformer/test/physics.test.mjs
node games/seed-man-platformer/test/public-runtime.test.mjs
node games/seed-man-platformer/test/input-guard.test.mjs
```

It also syntax-checks the browser JavaScript and verifies that the canonical physics/level files match the public copies.

Production verification is handled by `.github/workflows/seed-man-live-smoke.yml`. A live-success claim requires the cache-busted public route and required runtime assets to match the expanded 24-sprout build; an HTTP 200 by itself is not enough.

## Current status

`browser-expanded-level`

Source physics, expanded level, double jump, power-ups, keyboard controls, touch-control implementation, and regression tests are established. The remaining release gates intentionally stay open until there is evidence for them:

- mobile playtest
- final Seed Man sprite consistency review
- original production art/audio clearance

Do not mark those gates complete from static tests or HTTP smoke checks alone.