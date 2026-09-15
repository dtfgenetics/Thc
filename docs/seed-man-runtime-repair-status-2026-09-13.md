# Seed Man runtime repair status — 2026-09-13

This branch is the active repair pass for the v20 Seed Man game.

## Completed in this pass

- Corrected the character source of truth to `classic-seed-man-oval-v1`.
- Marked the green-armored runtime atlas as temporary/replacement-pending instead of final approved art.
- Corrected release gates so final art cannot report complete while SM-001 remains unfinished.
- Added authored flattened world-background keys for all five worlds as an interim runtime bridge while seven-layer world kits are produced.
- Added hazard-specific terrain presentation instead of drawing every hazard as the same spike strip.
- Added runtime behavior for moving platforms, vertical platforms, conveyors, collapsing bridge/ice pieces, crystal bounce, slippery ground, wind zones, heat updrafts, teleport roots, timed doors, and dark zones.
- Corrected Plant Seed Slinger pierce behavior.
- Corrected Electric to chain across three total targets within the catalogued range.
- Corrected Ice freeze duration to 1.8 seconds.
- Added stomp damage/bounce gameplay.
- Replaced generic boss attack behavior with distinct phased attack-pattern sets for all six bosses and synchronized boss attack phases to combat state.

## Still blocking final release

- SM-001 classic Seed Man master/reference set is not yet approved.
- Full classic Seed Man Plant/Fire/Electric/Ice animation families are not yet landed.
- Ten enemies still need unique production art/animation families.
- Six bosses still need unique production art and catalog-faithful named attack VFX.
- Five world masters need to be committed to the route and then replaced by final seven-layer kits.
- Remaining hazard/mechanic families need level-by-level tuning rather than generic runtime synthesis.
- Desktop/mobile human playthrough and final visual review are still required.

No Playwright workflow is part of this repair pass.