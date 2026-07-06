# High Land HIT Card Artwork

The approved HIT card art is locked as the source of truth for the live browser game.

## Approved live deck

The live approved master deck contains **39 unique HIT cards**.

Master card images should live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/master/
```

Variant/archive card images should live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/variants/
```

## Required master filename pattern

Use canonical descriptive filenames, not raw upload names and not the old 30-card placeholder naming system.

```txt
card-001-perfect-roll.png
card-002-cough-lock.png
card-003-rosin-rush.png
...
card-039-second-hit.png
```

## Code mapping rule

`src/game/data/actionCards.ts` must point `imageSrc` to the approved master files, for example:

```txt
assets/images/cards/hit/master/card-001-perfect-roll.png
```

Do not leave the live game pointing at old paths like:

```txt
assets/images/cards/hit/card-001.png
```

## Runtime rule

The HIT popup should show the approved artwork first. Fallback art is only acceptable while assets are missing during development; production should not show fallback art when approved master art exists.

## Related source-of-truth docs

- `docs/HIGH_LAND_APPROVED_HIT_CARDS.md`
- `apps/high-land-web/public/assets/images/cards/hit/APPROVED_HIT_CARD_ASSETS.md`
