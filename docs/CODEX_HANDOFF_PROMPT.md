# Codex Handoff Prompt

You are working in the GitHub repo `dtfgenetics/Thc`.

Your job is to finish the browser game **High Land: The Sweet Escape** using the files already created in this repository. Do not replace the game with a new generic template. Do not start over unless a file is truly broken beyond repair. Use the existing app, rules, docs, and structure.

## Source of truth

Use these first:

```txt
apps/high-land-web/
docs/CODEX_HANDOFF_PROMPT.md
docs/HANDOFF_STATUS.md
docs/VISUAL_LOCK.md
docs/ASSET_IMPORT_CHECKLIST.md
docs/DEPLOYMENT_RUNBOOK.md
docs/PLAYTEST_MATRIX.md
GitHub Issue #1: Finish High Land playable browser build
```

Treat other docs as planning notes only. Do not build from random old docs if they conflict with the source-of-truth files above.

## Main goal

Make the existing High Land browser game install, test, build, run locally, and be ready to deploy at:

```txt
https://dtfseeds.com/games/high-land/
```

The game must support:

```txt
2 to 10 players
single continuous board path
dice rolling
player tokens moving along the board
action/card spaces
skip turns
save/load
win condition
mobile-friendly layout
deployment under /games/high-land/
```

## Start here

Run these commands from the repo:

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

## Fix order

Fix errors in this exact order:

```txt
1. TypeScript errors
2. Unit test failures
3. Production build errors
4. Browser test failures
5. Phaser render errors
6. Asset path errors
7. Mobile layout errors
8. UI polish
```

Do not add multiplayer, new mechanics, new docs, or extra design ideas until install, test, build, browser tests, and local run all pass.

## Important app files

Inspect and fix these first:

```txt
apps/high-land-web/package.json
apps/high-land-web/tsconfig.json
apps/high-land-web/vite.config.ts
apps/high-land-web/playwright.config.ts
apps/high-land-web/e2e/high-land.spec.ts
apps/high-land-web/src/main.tsx
apps/high-land-web/src/App.tsx
apps/high-land-web/src/styles.css
apps/high-land-web/src/ui/PhaserBoard.tsx
apps/high-land-web/src/ui/DiceDisplay.tsx
apps/high-land-web/src/ui/CardRevealModal.tsx
apps/high-land-web/src/ui/GameRulesPanel.tsx
apps/high-land-web/src/ui/DevPanel.tsx
apps/high-land-web/src/game/HighLandGame.ts
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-web/src/game/data/boardPath.ts
apps/high-land-web/src/game/data/actionCards.ts
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/game/systems/turnSystem.ts
apps/high-land-web/src/game/systems/movementSystem.ts
apps/high-land-web/src/game/systems/diceSystem.ts
apps/high-land-web/src/game/systems/storageSystem.ts
apps/high-land-web/src/game/systems/audioSystem.ts
apps/high-land-web/src/game/systems/assetPath.ts
```

## Current expected problems

Check for these likely issues:

```txt
tsconfig settings may need adjustment for Playwright/e2e tests
package-lock.json may need to be committed if npm install created it inside apps/high-land-web
Playwright tests may need small fixes after the app actually runs
DiceDisplay and CardRevealModal may need CSS polish
BoardScene must not crash if final board PNG is missing
Board asset path must work under /games/high-land/
Final board image is not yet imported
boardPath.ts coordinates are not calibrated to final board art
multiplayer is not finished and should not be worked on yet
```

## Rules for fixing

When fixing:

```txt
Keep changes small
Prefer repairing existing files over adding new files
Do not add more planning docs
Do not delete working game systems
Do not replace Phaser + React setup
Do not remove 10-player support
Do not mix in other games like Weedopolis, High IQ, Strain Showdown, Bud or Bluff, or THC U Know
Do not use copyrighted Candy Land art, names, board layout, or card text
```

## Visual/game requirements

High Land must remain:

```txt
Adult 21+ THC community board game
Candy Land-style parody, but original
single continuous path
no disconnected routes
large colored spaces
action/card spaces
skip spaces
race to Cloud 9 Citadel finish
```

Locked world order:

```txt
Rolling Hills
Dankwood Forest
Rosin Rail Station
Munchie Mountain
Kief Caves
Trichome Towers
Cloud 9 Citadel
```

## Acceptance checklist

Before calling it done, verify:

```txt
npm install passes
npm run test passes
npm run build passes
npm run test:e2e passes
npm run dev opens the app
2-player game starts
4-player game starts
10-player game starts
Roll Dice works
tokens move
current player updates
action/card effects resolve
skip turns work
save/load works
winner condition works
mobile view is usable
production build works under /games/high-land/
```

## After the code runs

Only after all tests/build/run pass:

```txt
1. Add final board image to:
apps/high-land-web/public/assets/images/board/high-land-board.png

2. Calibrate:
apps/high-land-web/src/game/data/boardPath.ts

3. Add final card art to:
apps/high-land-web/public/assets/images/cards/

4. Add final audio to:
apps/high-land-web/public/assets/audio/

5. Polish dice/card UI in:
apps/high-land-web/src/styles.css
apps/high-land-web/src/ui/DiceDisplay.tsx
apps/high-land-web/src/ui/CardRevealModal.tsx
```

## Final output required

When finished, report:

```txt
What commands passed
What files changed
What errors were fixed
What still needs assets
Whether the game is ready to upload to /games/high-land/
```
