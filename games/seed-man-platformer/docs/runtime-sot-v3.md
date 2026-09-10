# Seed Man runtime source-of-truth v3 — RETIRED

This document is retained only as historical migration context. It does **not** define the current production game and must not be used to restore runtime files, level catalogs, UI, bosses, power-ups, or deployment behavior.

The former v3 path used `data/levels-02-11.json`, `src/course-generator.mjs`, and public `campaign-v1.js`. Those public compatibility artifacts are retired from the production route.

## Current production authority

Use these current v20 sources instead:

- `games/seed-man-platformer/README.md` — human-readable production contract.
- `games/seed-man-platformer/data/campaign.json` — 20-level campaign order and five-world ownership.
- `games/seed-man-platformer/data/levels-20-v1.json` — canonical 20-level catalog.
- `games/seed-man-platformer/src/systems/level-runtime.mjs` and `level-catalog.mjs` — deterministic level/runtime ownership.
- `site/public-route-patch/games/seed-man-platformer/campaign-v20-runtime.js` — browser campaign runtime.
- `site/public-route-patch/games/seed-man-platformer/player-state-v20.js` — browser player-state contract.
- `site/public-route-patch/games/seed-man-platformer/v20-enemy-runtime.js` — canonical public enemy/boss encounter runtime.
- `site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js` — current browser combat runtime.
- generated `three-world-v1.js` / `three-world-adapter-v1.js` — current presentation/world renderer.
- `site/deployment/release-resources.json` plus the Seed Man production verifier/publisher — release ownership.

Production is v20 only. Do not restore `campaign-v1.js`, `levels-02-11.json`, the retired Sprout Run bootstrap, or any 11/15-level runtime into the public route.
