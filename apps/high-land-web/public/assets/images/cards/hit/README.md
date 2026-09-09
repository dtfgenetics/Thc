# High Land HIT Card Artwork

The HIT card artwork folder supports the live browser game.

## Approved live deck

The live gameplay deck contains **39 unique HIT cards**.

Current asset status:

- `card-001` through `card-031` are committed PNG master cards.
- `card-032` through `card-039` are committed temporary SVG master cards.
- The game should stay functional with the temporary SVGs, but final print/live polish is not complete until those eight cards receive approved final art or are explicitly approved as final SVGs.

## Required master asset structure

Master card images live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/master/
```

Variant/archive card images live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/variants/
```

## Required master filename pattern

Use canonical descriptive filenames, not raw upload names and not the old 30-card placeholder naming system.

Current committed master examples:

```txt
card-001-perfect-roll.png
card-002-cough-lock.png
card-003-rosin-rush.png
...
card-031-kief-cave-slip.png
card-032-rolling-breeze.svg
...
card-039-second-hit.svg
```

Final approved PNG replacements should keep the same card ID and slug:

```txt
card-032-rolling-breeze.png
...
card-039-second-hit.png
```

When a PNG replacement is added, update `src/game/data/actionCards.ts` and `src/game/data/actionCards.test.ts` in the same change.

## Code mapping rule

`src/game/data/actionCards.ts` must point `imageSrc` to committed master files, for example:

```txt
assets/images/cards/hit/master/card-001-perfect-roll.png
```

Do not leave the live game pointing at old paths like:

```txt
assets/images/cards/hit/card-001.png
```

## Runtime rule

The HIT popup should show the committed master artwork first. Fallback art is only acceptable as an error state when the card-specific asset fails to load.

## Related source-of-truth docs

- `docs/HIGH_LAND_APPROVED_HIT_CARDS.md`
- `apps/high-land-web/public/assets/images/cards/hit/APPROVED_HIT_CARD_ASSETS.md`
