# Approved High Land HIT Card Assets

The approved HIT card art is locked as the source of truth.

## Required live asset structure

Master cards should live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/master/
```

Variant/archive cards should live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/variants/
```

## Master deck

The live approved deck contains **39 unique master cards**.

The live browser game should load these master assets, not random upload names like `1000017863.png`.

## Variant archive

The approved package also contains **9 variant cards**. These are duplicate-title alternate artworks and should be kept in the repo, but not loaded by the live game by default.

## Canonical naming pattern

Use names like:

```txt
card-001-perfect-roll.png
card-002-cough-lock.png
card-003-rosin-rush.png
...
card-039-second-hit.png
```

## Import workflow

1. Download/unzip the approved package.
2. Copy `master/` into:

```txt
apps/high-land-web/public/assets/images/cards/hit/master/
```

3. Copy `variants/` into:

```txt
apps/high-land-web/public/assets/images/cards/hit/variants/
```

4. Commit the assets.
5. Update `src/game/data/actionCards.ts` so `imageSrc` points to the approved master files.

## Runtime rule

Do not allow the game to show fallback art when approved master art exists.
