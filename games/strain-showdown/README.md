# Strain Showdown

**Strain Showdown** is an original cannabis-themed trading-card battle game. This README records the current implementation and data model; it does not lock the game to a family roster, tier structure, card count, renderer, engine, route, repository, effect vocabulary, or release workflow.

## Current content model

The current prototype uses eight families: Kush, Haze, Skunk, Gas, Cookies, Fruit, Purple, and Frost. The current core roster contains 96 strain cards arranged as 6 Base, 4 Select, and 2 Elite cards per family.

Those values are current-state data and may be redesigned, expanded, reduced, renamed, or replaced when the game direction changes.

## Current browser ruleset

The present implementation uses Vigor and Power, three battlefield lanes, Garden health, Focus resources, staged evolution, family passives, and solo CPU play. These mechanics may be kept, rebalanced, replaced, or rebuilt. Tests and data validators should follow the intended current rules rather than force obsolete mechanics to remain.

## Current data and tooling

Useful current files include:

```txt
data/roster-manifest.json
data/families.json
data/effect-profiles.json
scripts/validate-roster.mjs
scripts/validate-effects.mjs
scripts/validate-browser-build.mjs
scripts/simulate-balance.mjs
test/engine.test.mjs
site/public-route-patch/games/strain-showdown/
```

These paths and validators are implementation references, not permanent ownership boundaries. If the game moves or the schema changes, update or replace them.

## Visual redesign

The current browser prototype is not a visual constraint. The front end, card frames, battlefield, animation, VFX, menus, responsive layout, and complete art system may be rebuilt from scratch. Current gameplay/data systems may be reused selectively when useful.

## Quality and release

When mechanics or content change, verify the resulting roster/schema, legal actions, turn flow, scoring/win logic, balance assumptions, responsive presentation, asset loading, and browser behavior using checks appropriate to the new implementation. Human playtesting and visual review should evaluate the redesigned game rather than require the previous prototype to remain unchanged.

Current public reference: `https://dtfseeds.com/games/strain-showdown/`. This route may also change if the deployment architecture is deliberately migrated.
