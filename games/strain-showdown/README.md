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

## Draft effect authoring

The first controlled effect-authoring layer now lives in `data/effect-profiles.json`.

- 24 profiles cover every combination of the 8 families and 3 stages.
- Every canonical card deterministically maps to exactly one profile through `family + stage`.
- Each card's existing `roleTag` becomes its draft ability name, so all 96 cards have a stable per-card ability label without duplicating effect logic across 96 scripts.
- The mechanic vocabulary is deliberately small and machine-validatable: shields, attack bonuses, shield breaking, breakthrough damage, adaptive resource/recovery, Garden healing, evolution draws, recovery bonuses, and evolution protection.
- `scripts/validate-effects.mjs` proves that all 96 cards are covered and that no unsupported mechanic or out-of-range value enters the draft catalog.
- These effects are **not active in the browser battle rules yet**. Activation is a separate balance-integration gate so authored text cannot silently change the live ruleset before simulation and human playtesting.

## Verification

- `data/roster-manifest.json` controls roster count, files, tier distribution, stage progression, and current effect-authoring state.
- `data/families.json` controls family identity.
- `data/effect-profiles.json` controls the draft effect vocabulary and family/stage profiles.
- `scripts/validate-roster.mjs` checks the canonical 96-card roster and DTF Genetics catalog cross-links.
- `scripts/validate-effects.mjs` validates 96-card draft ability coverage.
- `test/engine.test.mjs` exercises setup, legal play, evolution prerequisites, attacks, turn flow, and CPU actions.
- `scripts/validate-browser-build.mjs` verifies that the public runtime and public roster remain synchronized with canonical source.
- `scripts/simulate-balance.mjs` alternates the starting side and runs deterministic family-vs-family matches so tuning can be measured instead of guessed. CI requires all automated family win rates to stay between 40% and 68% with no more than a 25-point spread.
- `.github/workflows/strain-showdown-ci.yml` runs roster, effect-authoring, engine, simulation, and public-runtime checks for pull requests and changes to `main`.

## Public runtime

The self-hosted browser prototype lives at `site/public-route-patch/games/strain-showdown/` and is packaged for:

`https://dtfseeds.com/games/strain-showdown/`

The browser build includes family selection, a CPU rival, three-lane play, Base/Select/Elite evolution, family passives, Focus economy, Garden health, match history, battle feedback, rematches, keyboard-accessible card selection, and responsive controls.

## Deliberately open gates

The playable prototype is not the final printed TCG ruleset. These remain open and must not be represented as complete:

- activation and measured tuning of the authored draft effect profiles;
- final per-card tournament wording and exceptions after effect playtesting;
- balance approval based on simulation plus human playtesting;
- final tournament/rules wording;
- final card art and rights clearance;
- print proof and production approval.

Current status: **playable browser prototype + complete draft effect-profile coverage**. The next design phase is engine integration of the validated effect vocabulary, measured balance tuning, and human playtesting rather than rebuilding the browser game from scratch.
