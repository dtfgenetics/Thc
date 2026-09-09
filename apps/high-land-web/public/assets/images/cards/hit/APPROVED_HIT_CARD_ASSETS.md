# Approved High Land HIT Card Assets

This folder is the live asset home for High Land HIT card artwork.

## Required live asset structure

Master cards live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/master/
```

Variant/archive cards live here:

```txt
apps/high-land-web/public/assets/images/cards/hit/variants/
```

## Master deck status

The live gameplay deck contains **39 unique master cards**.

Current committed asset state:

- **31 PNG master cards**: `card-001` through `card-031`
- **8 temporary SVG master cards**: `card-032` through `card-039`

The SVG files keep the live game from falling back to generic artwork, but they should be treated as visible art debt until final approved masters are added.

## Variant archive

The approved package also contains **9 variant cards**. These are duplicate-title alternate artworks and should be kept in the repo, but not loaded by the live game by default.

## Canonical naming pattern

Use names like:

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

When approved final art arrives for cards `032` through `039`, prefer matching PNG names:

```txt
card-032-rolling-breeze.png
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
5. Update `src/game/data/actionCards.ts` so `imageSrc` points to the committed master files.
6. Update the HIT card tests so expected filenames match the committed asset inventory.

The import script accepts `.png` and `.svg` master assets so it can handle the current mixed production state without silently dropping cards.

## Runtime rule

Do not allow the game to show fallback art when committed card-specific master art exists.
