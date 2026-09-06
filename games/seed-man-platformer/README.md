# Seed Man Platformer

The **Seed Man Platformer** is an original DTF Genetics browser platformer starring the locked Seed Man mascot. The production route is `/games/seed-man-platformer/`.

## Character contract

Seed Man remains a short, chubby oval seed with a simple face, three-leaf sprout, rubber-hose limbs, white gloves and shoes, thick outline, and flat 2D treatment. Animation can exaggerate movement, squash/stretch and poses, but it must preserve that silhouette and identity.

The route keeps the original Canvas2D production-art layer (`seed-man-production-v1`) and now adds **Seed Man animation-v2** after the base game loads. Animation-v2 improves motion readability without changing collision geometry or physics:

- idle breathing and blinking
- speed-sensitive run stride and body lean
- airborne stretch
- double-jump pose and ring feedback
- landing squash and recovery
- hurt expression
- boss-stomp recoil
- finish celebration
- leaf follow-through
- speed trails

The runtime exposes `window.__SPROUT_ANIMATION_V2__` with the locked `seed-man-locked-v1` invariants.

## Eleven-level campaign

Greenhouse Gauntlet remains Level 1. This campaign adds **10 new levels**, for **11 total levels across four worlds**:

### World 1 — Greenhouse District
1. **Greenhouse Gauntlet** — established 7,800px proving ground
2. **Nursery Night Shift** — moonlit propagation nursery; bounce-pad routing
3. **Reservoir Run** — hydro reservoir currents; **The Phantom Pump** boss

### World 2 — Rootworks
4. **Root Zone Rumble** — root maze and media drag zones
5. **Mycelium Mile** — bioluminescent fungal undergarden and updrafts
6. **Trichome Transit** — resin rail yard and boost lanes; **Mite Queen** boss

### World 3 — Resin Works
7. **Kief Cavern Climb** — vertical cavern bounce routes
8. **Rosin Refinery Rush** — heat vents and industrial pressure lanes
9. **Terpene Tunnel** — alternating vapor gusts; **Mildew Wraith** boss

### World 4 — Sky Garden
10. **Frostline Canopy** — frost/slip traversal
11. **Cloud Nine Citadel** — alternating sky-garden winds; **Pollen Warden** final boss

The four boss encounters are gameplay-state encounters, not decorative DOM overlays. Boss stages require repeated stomp hits before the finish can unlock. Required hits rise from 3 to 5 across the campaign.

## Campaign systems

The campaign runtime is self-contained in the already-allowlisted public `campaign-v1.js` so the dedicated WordPress publisher does not need an extra runtime dependency. It activates only after the proven base game has loaded.

The campaign includes:

- level selector for all 11 stages
- Next Level flow after successful completion
- per-level completion records and best times
- four themed worlds
- ten unique settings and palettes
- nine traversal mechanic families
- four boss health/finish gates
- generated stage geometry from canonical level templates
- checkpoint recovery on every generated stage
- keyboard and touch support through the existing control layer
- no runtime fetch and no browser-module dependency

The original Level 1 continues to use the established gameplay-v2 systems: moving greenhouse tables, stompable pests, bounce pads, particles, screen shake and the proven fixed-step physics. Levels 2–11 use the same core movement constants through a generated-level physics path, avoiding Level 1-specific moving-table/pest coordinates from leaking into unrelated settings.

## Canonical source

- physics: `games/seed-man-platformer/src/physics.mjs`
- campaign manifest: `games/seed-man-platformer/data/campaign.json`
- Greenhouse Gauntlet: `games/seed-man-platformer/data/level-01.json`
- Levels 2–11 templates: `games/seed-man-platformer/data/levels-02-11.json`
- generated course contract: `games/seed-man-platformer/src/course-generator.mjs`
- metadata/release gates: `games/seed-man-platformer/game.json`
- Level 1 browser acceptance: `games/seed-man-platformer/test/browser-smoke.mjs`
- campaign/browser/boss acceptance: `games/seed-man-platformer/test/campaign-browser.test.mjs`
- public campaign + animation runtime: `site/public-route-patch/games/seed-man-platformer/campaign-v1.js`
- base production character art: `site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js`
- public route source: `site/public-route-patch/games/seed-man-platformer/`

Canonical campaign/level-pack copies must remain synchronized with the public route source.

## Existing movement and playability foundation

The campaign retains the established platformer feel:

- fixed 60Hz simulation
- coyote time and jump buffering
- higher base jump
- one true mid-air double jump per landing
- variable jump height: tap for short hop, hold for full height
- progressive ground and air acceleration/deceleration
- refresh-rate-independent camera follow
- pointer-captured mobile controls
- speed, high-jump, magnet and shield power-ups
- pause and guarded restart
- accessible keyboard/touch controls
- reduced-motion support

Greenhouse Gauntlet still contains 24 required sprouts, 7 power-ups, 3 checkpoints and 15 hazard zones. Generated levels scale from 16 to 26 sprouts and increase hazard/mechanic complexity through the campaign.

## Three.js world work

The self-contained Three.js 2.5D renderer remains a **render-only prototype**. It does not own collision, campaign state, bosses, collectibles, checkpoints or player movement. The current Canvas2D campaign remains authoritative until the Three.js progressive-enhancement layer separately clears desktop/mobile/fallback/live gates.

## Validation

The dedicated workflow is `.github/workflows/seed-man-platformer-ci.yml` and includes:

```bash
node games/seed-man-platformer/test/physics.test.mjs
node games/seed-man-platformer/test/campaign.test.mjs
node games/seed-man-platformer/test/three-world-state.test.mjs
node games/seed-man-platformer/test/public-runtime.test.mjs
node games/seed-man-platformer/test/public-campaign.test.mjs
node games/seed-man-platformer/test/input-guard.test.mjs
node games/seed-man-platformer/test/browser-smoke.mjs
node games/seed-man-platformer/test/campaign-browser.test.mjs
```

Campaign tests require all ten new templates to produce bounded stage geometry, unique settings, nine mechanic families, four boss encounters, checkpoint recovery, increasing difficulty and canonical/public data parity.

The campaign browser test runs desktop and mobile Chromium, switches through every level, checks theme/mechanic changes, tests the Nursery bounce mechanic, verifies the Reservoir boss finish gate, stomps The Phantom Pump through its hit count, and confirms the level can only finish after the boss is defeated.

Production verification additionally runs the campaign browser test against the live DTFSeeds route. An HTTP 200 is never sufficient evidence of a successful campaign release.

## Current status

`campaign-v3-production-candidate`

The 11-level campaign, unique settings, boss system and animation-v2 are established on the feature branch. They must still pass the full source/Chromium/release gate and merge before being called released/live.

Human-only gates remain open until direct evidence exists:

- physical-device mobile playtest
- final visual consistency review of Seed Man in motion

Audio remains optional and is not a gameplay blocker.
