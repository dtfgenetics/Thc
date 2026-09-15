# Seed Man Platformer

The **Seed Man Platformer** is the DTF Genetics browser action-platformer for `https://dtfseeds.com/games/seed-man-platformer/`.

## Production source of truth

The production character target is **classic-seed-man-oval-v1**. This is the locked Seed Man identity: short chubby oval seed body, flat 2D vector treatment, thick outline, rubber-hose limbs, white gloves and white shoes, simple expressive face, and a three-leaf sprout. No armor, costume, realistic material shading, or character redesign is permitted in the final production character.

The existing green-armored atlas is a **temporary legacy runtime asset only** while the classic Seed Man animation family is rebuilt. It must not be described as approved final character art and must not be used as the visual source of truth for new work.

The visual contract is encoded in:

- `games/seed-man-platformer/data/seed-man-art-manifest-v1.json`
- `games/seed-man-platformer/src/render/art-registry.mjs`
- `games/seed-man-platformer/src/render/visual-runtime-v2.mjs`
- `games/seed-man-platformer/src/render/approved-art-loader.mjs`
- `data/game-asset-batches/SM-001.json`

Production policy:

- `classic-seed-man-oval-v1` is authoritative for the player character
- the current green-armored character atlas is temporary and replacement-pending
- raw filenames are not the public asset API
- code references stable manifest keys
- procedural character fallback is disabled
- legacy character atlas fallback is disabled once the classic animation family lands
- simulation owns collision/gameplay state
- renderer only presents simulation state
- corrupt or mislabeled image files must fail validation
- authored world imagery may be used as a temporary single-layer runtime background, but the final world target remains seven authored layers per world: sky, far-bg, mid-bg, near-bg, gameplay, foreground, and vfx
- the game must never advertise an unfinished renderer or temporary art as completed/approved production art

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
- `site/public-route-patch/games/seed-man-platformer/input-guard-v1.js`
- `site/public-route-patch/games/seed-man-platformer/three-world-v1.js`
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

## Combat and phenotype powers

Seed Man has four canonical forms:

- **Plant** — permanent base form; Seed Slinger has piercing behavior
- **Fire** — temporary 30-second form; stronger burning projectile attacks
- **Electric** — temporary 30-second form; chaining electric attacks up to three targets total
- **Ice** — temporary 30-second form; freezing attacks with the catalogued freeze duration

Fire, Electric, and Ice are earned from phenotype carriers/minor encounters. They transform the same classic Seed Man character rather than creating unrelated character designs.

Canonical systems:

- `games/seed-man-platformer/src/systems/phenotype-system.mjs`
- `games/seed-man-platformer/src/systems/power-drop.mjs`
- `games/seed-man-platformer/data/powerup-catalog-v1.json`
- `games/seed-man-platformer/data/enemy-catalog-v1.json`

Retired speed, jump, magnet, shield, Hydro Surge, Terpene Tempest, Vine Lash, Mycelium Mind, Rootbreaker, Trichome Crystal, Gravity Haze, Solar Flare, Static Haze, and Frost Resin power contracts must not be reintroduced into production gameplay.

## Enemies and bosses

The production enemy catalog is data-driven. Current core enemy archetypes are Sproutling, Root Crawler, Toxic Spore, Drone Bot, Thorn Beetle, Sky Wasp, Spike Plant, Sludge Monster, Bone Weed, and Shadow Root.

Final production requires each enemy archetype to have visually readable identity and behavior rather than reusing an indistinguishable atlas frame solely because the gameplay role differs.

Bosses use a reusable phased boss state machine:

- Overgrown Guardian
- Ancient Dryad
- Scorchroot Titan
- Frostbite Colossus
- Eco Sentinel
- **Blight King** — four-phase final boss

Boss levels are exit-gated: reaching the finish does not complete a boss level while its boss is alive. Boss defeat must synchronize back into level/campaign state before the exit unlocks.

The Blight King cycles weaknesses through Plant → Fire → Electric → Ice and ends the game only after the Level 20 finale completes.

Each boss must also execute its catalogued attack family rather than a generic shared attack placeholder.

Canonical boss systems:

- `games/seed-man-platformer/data/boss-catalog-v1.json`
- `games/seed-man-platformer/src/systems/boss-state-machine.mjs`
- `games/seed-man-platformer/src/systems/final-boss-director.mjs`
- `games/seed-man-platformer/src/systems/world-boss-map.mjs`

## Worlds, platforms, hazards, HUD and VFX

World presentation is keyed to five distinct art directions:

- Greenhouse Valley
- Forest Ruins
- Desert Canyon
- Frozen Peaks
- Eco City

Final production requires seven authored visual layers per world. Temporary flattened world masters may be used only as an integration bridge and must not define collision geometry.

Terrain behavior is separated from terrain art. Grass, dirt, rock, stone, ice, sand, metal, wood, moving platforms, conveyors, collapsing platforms and springs are selected through data while physics behavior comes from simulation/runtime modules.

Named level mechanics in the catalog are requirements, not decoration. Moving platforms, vertical platforms, collapsing platforms, conveyors, slippery ground, crystal bounce, wind zones, dark zones, teleport roots, timed doors, lasers, crushers and other named mechanics must materially affect play before a level is considered finished.

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

A release must not be called final until classic Seed Man artwork, full phenotype animation families, authored world presentation, named level mechanics, unique boss behaviors, desktop/mobile playtesting and human visual review all pass.