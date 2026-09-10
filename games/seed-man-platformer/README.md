# Seed Man Platformer

The **Seed Man Platformer** is the DTF Genetics browser action-platformer for `https://dtfseeds.com/games/seed-man-platformer/`.

## Production source of truth

The approved 2026-09-08 Seed Man showcase boards are authoritative for the game art. Existing procedural renderers, older brown-seed art, legacy sprite atlases, and stale documentation are **not** authoritative.

The production character is the approved **green armored plant-hero Seed Man** shown in the approved showcase: large leaf-shaped head silhouette, expressive face, green/white/black body treatment, white gloves and boots, and consistent platformer proportions. Plant, Fire, Electric, and Ice are gameplay forms of that same character.

The visual contract is encoded in:

- `games/seed-man-platformer/data/seed-man-art-manifest-v1.json`
- `games/seed-man-platformer/src/render/art-registry.mjs`
- `games/seed-man-platformer/src/render/visual-runtime-v2.mjs`
- `games/seed-man-platformer/src/render/approved-art-loader.mjs`

Production policy:

- approved artwork is authoritative
- raw filenames are not the public asset API
- code references stable manifest keys
- procedural character fallback is disabled
- legacy atlas fallback is disabled
- simulation owns collision/gameplay state
- renderer only presents simulation state
- corrupt or mislabeled image files must fail validation and must never be shipped merely because their extension looks correct
- world presentation is owned by the generated Three.js renderer, with the deterministic canvas world renderer only as the non-WebGL fallback

## 20-level campaign

The production campaign identity is `seed-man-campaign-20-v1` and contains **20 levels across five worlds**, four levels per world:

### World 1 — Greenhouse Valley
1. Sprout Steps
2. Sunny Glade
3. Waterfall Way
4. Greenhouse Hub — Overgrown Guardian boss

### World 2 — Forest Ruins
5. Mossy Paths
6. Broken Bridges
7. Hollow Trunk
8. Temple of Trees — Ancient Dryad boss

### World 3 — Desert Canyon
9. Red Rock Run
10. Canyon Cliffs
11. Dusty Winds
12. Sun Spire — Scorchroot Titan boss

### World 4 — Frozen Peaks
13. Icy Pass
14. Crystal Caverns
15. Frozen Bridges
16. Glacier Gate — Frostbite Colossus boss

### World 5 — Eco City
17. Toxic Outskirts
18. Industrial Zone
19. Reactor Core — Eco Sentinel boss
20. The Last Seed — **Blight King final boss**

Canonical campaign files:

- `games/seed-man-platformer/data/campaign.json`
- `games/seed-man-platformer/data/campaign-20-v1.json`
- `games/seed-man-platformer/data/levels-20-v1.json`
- `games/seed-man-platformer/src/systems/level-catalog.mjs`
- `games/seed-man-platformer/src/systems/level-runtime.mjs`
- `games/seed-man-platformer/src/systems/campaign-state-v2.mjs`
- `games/seed-man-platformer/src/systems/save-state-v2.mjs`

The campaign manifest must not contain the retired embedded-bootstrap field `publicDataElementId`.

## Production/retired boundary

The current production contract is **v20 only**. Sprout Run, the v3 generated 2–11 stages, and the 11/15-level public runtimes are retired and must not be restored to source-of-truth or the deployable route.

Retired campaign/runtime artifacts include:

- `data/level-01.json`
- `data/levels-02-11.json`
- `data/levels-12-15.json`
- `campaign-v1.js`
- `gameplay-v2.js`
- public `physics.mjs`
- `campaign-combat-v20.js`
- `campaign-progress-v20.js`
- `campaign-runtime-v20.js`
- `campaign-ui-v15.js`
- `world-five-v1.js`
- `combat-browser-v1.js`
- `enemy-attacks-browser-v1.js`
- `seed-man-ui-v3.js`
- corrupt `seed-man-approved-master-atlas-v1.webp`
- invalid `seed-man-cover-banner-approved-v1.webp`

Those files may exist only in historical Git data or explicit archive documentation. They may not be runtime dependencies, canonical level sources, release inputs, test requirements, publisher assets, or public-route files.

Current v20 runtime/release ownership is represented by:

- `games/seed-man-platformer/data/campaign.json`
- `games/seed-man-platformer/data/levels-20-v1.json`
- `site/public-route-patch/games/seed-man-platformer/app.js`
- `site/public-route-patch/games/seed-man-platformer/player-state-v20.js`
- `site/public-route-patch/games/seed-man-platformer/input-guard-v1.js` — v20 keyboard-focus guard only; no gameplay/signature engine
- `site/public-route-patch/games/seed-man-platformer/three-world-v1.js` generated from canonical Three.js source
- `site/public-route-patch/games/seed-man-platformer/campaign-v20-runtime.js`
- `site/public-route-patch/games/seed-man-platformer/campaign-ui-v20.js`
- `site/public-route-patch/games/seed-man-platformer/v20-enemy-runtime.js`
- `site/public-route-patch/games/seed-man-platformer/combat-browser-v2.js`
- `site/public-route-patch/games/seed-man-platformer/enemy-attacks-browser-v2.js`
- `scripts/verify-seed-man-production-v20.mjs`
- `scripts/validate-seed-man-production-bundle.mjs`
- `.github/workflows/seed-man-platformer-ci.yml`
- `.github/workflows/seed-man-production-bundle-validation.yml`
- `.github/workflows/seed-man-v20-finale-ci.yml`
- `.github/workflows/publish-seed-man-production.yml`
- `.github/workflows/repair-seed-man-v20-production.yml`

Retired 11-level/15-level workflows belong under `docs/archive/seed-man/legacy-15-level/workflows/` and must not be restored to `.github/workflows/`.

## Combat and phenotype powers

Seed Man has four canonical forms:

- **Plant** — permanent base form
- **Fire** — temporary 30-second form, burning projectile attacks
- **Electric** — temporary 30-second form, chaining electric attacks
- **Ice** — temporary 30-second form, freezing attacks

Fire, Electric, and Ice are earned from phenotype carriers/minor encounters. They do not replace the character identity; they transform the approved Seed Man artwork while preserving the same animation/state controller.

Canonical systems:

- `games/seed-man-platformer/src/systems/phenotype-system.mjs`
- `games/seed-man-platformer/src/systems/power-drop.mjs`
- `games/seed-man-platformer/data/enemy-catalog-v1.json`

Retired speed, jump, magnet, shield, Hydro Surge, Terpene Tempest, Vine Lash, Mycelium Mind, Rootbreaker, Trichome Crystal, Gravity Haze, Solar Flare, Static Haze, and Frost Resin power contracts must not be reintroduced into production gameplay.

## Enemies and bosses

The production enemy catalog is data-driven and uses the approved enemy atlas. Current core enemy archetypes include Sproutling, Root Crawler, Toxic Spore, Drone Bot, Thorn Beetle, Sky Wasp, Spike Plant, Sludge Monster, Bone Weed, and Shadow Root.

Bosses use a reusable phased boss state machine rather than level-specific ad hoc logic:

- Overgrown Guardian
- Ancient Dryad
- Scorchroot Titan
- Frostbite Colossus
- Eco Sentinel
- **Blight King** — four-phase final boss

Boss levels are exit-gated: reaching the finish does not complete a boss level while its boss is alive. Boss defeat must synchronize back into level/campaign state before the exit unlocks.

The Blight King cycles weaknesses through Plant → Fire → Electric → Ice and ends the game only after the Level 20 finale completes.

Canonical boss systems:

- `games/seed-man-platformer/data/boss-catalog-v1.json`
- `games/seed-man-platformer/src/systems/boss-state-machine.mjs`
- `games/seed-man-platformer/src/systems/final-boss-director.mjs`
- `games/seed-man-platformer/src/systems/world-boss-map.mjs`

## Worlds, platforms, HUD and VFX

World presentation is keyed to the approved five-world art direction:

- Greenhouse Valley
- Forest Ruins
- Desert Canyon
- Frozen Peaks
- Eco City

The generated `seed-man-three-world-v2` renderer is the production world renderer. It receives campaign/simulation state and does not own collisions, player health, combat, progression, or saves. The canvas world renderer is a deterministic non-WebGL fallback, not a second game runtime.

Terrain behavior is separated from terrain art. Grass, dirt, rock, stone, ice, sand, metal, wood, moving platforms and springs are selected through manifest/data keys while physics behavior comes from simulation modules.

Relevant modules:

- `games/seed-man-platformer/src/systems/world-theme.mjs`
- `games/seed-man-platformer/src/systems/platform-surface-map.mjs`
- `games/seed-man-platformer/src/render/three-world.mjs`

## HUD and player state

Browser player state is owned by `player-state-v20.js` and must remain free of the retired speed/jump/magnet/shield power model. HUD, combat, campaign UI, deaths, checkpoint state and phenotype presentation read from the canonical v20 state rather than rebuilding incompatible state independently.

The shipped input guard only protects keyboard behavior on interactive HTML controls. It must not contain a second gameplay engine or old level-specific signature mechanics.

## Release gate

The deterministic production gate is:

```bash
npm --prefix games/seed-man-platformer run test:production-contracts
npm --prefix games/seed-man-platformer run build:three-public
node scripts/verify-seed-man-production-v20.mjs
node scripts/validate-seed-man-production-bundle.mjs
```

The WordPress publisher then atomically stages the allowlisted v20 route, verifies hashes and the staged production contract, swaps it into `/games/seed-man-platformer/`, purges cache, and performs cache-busted live HTTP verification. Playwright is not part of this workflow.
