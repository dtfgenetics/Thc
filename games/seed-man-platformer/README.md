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

The production campaign contains **20 levels across five worlds**, four levels per world:

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

## Production/retired boundary

The current production contract is **v20 only**. Sprout Run, 11-level, and 15-level public runtimes are retired and must not be restored to the deployable route.

Retired public artifacts include:

- `data/level-01.json`
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

Those files may exist only in historical Git data or explicit archive documentation. They may not be runtime dependencies, release inputs, test requirements, publisher assets, or public-route files.

Current v20 runtime/release ownership is represented by:

- `games/seed-man-platformer/data/campaign.json`
- `games/seed-man-platformer/data/levels-20-v1.json`
- `site/public-route-patch/games/seed-man-platformer/app.js`
- `site/public-route-patch/games/seed-man-platformer/player-state-v20.js`
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
- `games/seed-man-platformer/src/systems/hud-model.mjs`
- `games/seed-man-platformer/src/systems/vfx-catalog.mjs`
- `games/seed-man-platformer/src/systems/collectible-catalog.mjs`
- `games/seed-man-platformer/src/systems/audio-events.mjs`

## Runtime architecture

The project keeps gameplay/simulation independent from rendering. The Three.js layer is the browser world renderer, but it is a view adapter—not the owner of player state, collisions, bosses, progression, or save state.

Core rules:

- `campaign-v20-runtime.js` is the only public campaign/level authority
- `player-state-v20.js` owns the public player-state contract
- fixed gameplay simulation owns entities and collision
- combat/enemy runtimes use only canonical production IDs
- renderer consumes stable state
- DOM handles HUD/menu/accessibility surfaces
- asset manifest keys are the only production asset API
- approved art loader fails loudly if required production assets are unavailable
- no renderer may silently replace the approved character runtime
- the public page must not embed a `seed-man-level` Sprout Run bootstrap JSON block
- generated public runtime files must be built from canonical source before release packaging

The production composition boundary is:

- `games/seed-man-platformer/src/systems/production-assets.mjs`
- `games/seed-man-platformer/src/systems/production-bootstrap.mjs`
- `games/seed-man-platformer/src/systems/game-contract.mjs`
- `games/seed-man-platformer/src/systems/production-readiness.mjs`
- `games/seed-man-platformer/src/systems/release-contract.mjs`

## Validation

Run:

```bash
npm --prefix games/seed-man-platformer run test:production-contracts
npm --prefix games/seed-man-platformer run build:three-public
node scripts/verify-seed-man-production-v20.mjs
node scripts/validate-seed-man-production-bundle.mjs
```

The production test suite validates approved-art ownership, 20 contiguous levels, five worlds, world/level mapping, phenotype timing, phenotype drops, boss phases, final-boss behavior, campaign progression, save state, HUD model, input actions, terrain behavior, manifest-key policy, production readiness, source/public physics parity, boss-gated exits, and Three.js state boundaries.

The live release must also pass deterministic source/build validation, atomic publisher validation, public asset validation, and live production route verification before it is called released.

## Current migration rule

Migration is complete at the public-route contract level: **v20 is canonical and Sprout Run/11-level/15-level runtime ownership is retired.** Future Seed Man work must begin from the 20-level campaign, v20 player/combat contracts, generated Three.js world renderer, and approved-art manifest described above. Do not restore retired public files to make an obsolete test pass; update the obsolete test or release guard to the v20 contract instead.
