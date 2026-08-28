# Strain Showdown

**Strain Showdown** is an original cannabis-themed trading-card battle game organized around eight strain families. This directory owns the canonical 96-card roster, family identities, deterministic rules engine, simulation tooling, tests, and release metadata used by the dtfseeds.com browser prototype.

## Locked families

Kush, Haze, Skunk, Gas, Cookies, Fruit, Purple, Frost.

## Locked card progression

Each family contains 12 strain cards: 6 Tier 1 Base, 4 Tier 2 Select, and 2 Tier 3 Elite, for a 96-strain core roster.

## Playable browser ruleset

- **Vigor** is the primary defensive stat.
- **Power** is the primary attacking stat.
- The battlefield has three lanes.
- Each side begins with 20 Garden and 3 Focus.
- Stage 1 Base cards enter empty lanes.
- Stage 2 Select cards evolve same-family Stage 1 cards.
- Stage 3 Elite cards evolve same-family Stage 2 cards.
- Attacks hit the opposing card in the same lane; open lanes damage Garden directly.
- Eight family passives create distinct prototype play styles.
- A match ends when a Garden reaches 0 or after the 18-round board-strength tiebreak.
- The current visitor-facing mode is solo vs CPU.

## Verification

- `data/roster-manifest.json` controls roster count, files, tier distribution, and stage progression.
- `data/families.json` controls family identity.
- `scripts/validate-roster.mjs` checks the canonical 96-card roster and DTF Genetics catalog cross-links.
- `test/engine.test.mjs` exercises setup, legal play, evolution prerequisites, attacks, turn flow, and CPU actions.
- `scripts/validate-browser-build.mjs` verifies that the public runtime and public roster remain synchronized with canonical source.
- `scripts/simulate-balance.mjs` runs deterministic family-vs-family matches so tuning can be measured instead of guessed.
- `.github/workflows/strain-showdown-ci.yml` runs roster, engine, simulation, and public-runtime checks for pull requests and changes to `main`.

## Public runtime

The self-hosted browser prototype lives at `site/public-route-patch/games/strain-showdown/` and is packaged for:

`https://dtfseeds.com/games/strain-showdown/`

The browser build includes family selection, a CPU rival, three-lane play, Base/Select/Elite evolution, family passives, Focus economy, Garden health, match history, battle feedback, rematches, keyboard-accessible card selection, and responsive controls.

## Deliberately open gates

The playable prototype is not the final printed TCG ruleset. These remain open and must not be represented as complete:

- final per-card effect text and effect validation;
- balance approval based on simulation plus human playtesting;
- final tournament/rules wording;
- final card art and rights clearance;
- print proof and production approval.

Current status: **playable browser prototype** with tested core rules and a locked 96-card roster. The next design phase is effect authoring, measured balance tuning, and human playtesting rather than rebuilding the browser game from scratch.
