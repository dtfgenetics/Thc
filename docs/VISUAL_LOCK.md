# Visual Lock

This file locks the visual direction for the browser game so Codex does not replace it with a generic board game.

## Locked board identity

Game title:

```txt
High Land: The Sweet Escape
```

The board must look like a fantasy candy-road adventure with original THC parody locations. It must not copy Candy Land art, layout, branding, card text, or protected characters.

## Locked board locations

The route order is:

1. Rolling Hills
2. Dankwood Forest
3. Rosin Rail Station
4. Munchie Mountain
5. Kief Caves
6. Trichome Towers
7. Cloud 9 Citadel

## Locked path requirements

- One continuous path.
- No disconnected spaces.
- No alternate routes unless intentionally added later.
- Colored squares: red, yellow, green, blue, purple.
- Special spaces: CARD, SKIP, BOOST, TRAP, SAFE.
- Thick white edge around the path.
- START and FINISH must be obvious.

## Uploaded visual references

The user uploaded a board image and multiple HIT/action card sheets in chat. Codex must treat those as the visual source of truth.

Use these local asset paths when adding final files:

```txt
apps/high-land-web/public/assets/images/board/high-land-board.png
apps/high-land-web/public/assets/images/cards/card-back.png
apps/high-land-web/public/assets/images/cards/card-front-template.png
apps/high-land-web/public/assets/images/cards/hit-card-sheet-01.png
apps/high-land-web/public/assets/images/cards/hit-card-sheet-02.png
apps/high-land-web/public/assets/images/cards/hit-card-sheet-03.png
```

## Current code behavior

`BoardScene.ts` now supports a real board background at:

```txt
/assets/images/board/high-land-board.png
```

If that asset is missing, it renders the generated fallback board. The fallback is for development only.

## Do not change

- Do not replace the board with a generic Monopoly-style board.
- Do not mix in Weedopolis, High IQ, Strain Showdown, Bud or Bluff, or THC U Know.
- Do not use fake transparent checkerboards.
- Do not use copyrighted Candy Land artwork.
- Do not remove the single continuous path.
