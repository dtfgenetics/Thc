# Codex Handoff Prompt

You are working in the GitHub repo `dtfgenetics/Thc`.

Finish and verify **High Land: The Sweet Escape** using the existing app in `apps/high-land-web`. Do not replace it with a generic template, do not restart the game from scratch, and do not mix in another DTF game.

## Source of truth

Read these first:

```txt
AGENTS.md
CLAUDE.md
README.md
docs/HIGH_LAND_SOURCE_OF_TRUTH.md
docs/HIGH_LAND_CODE_STATUS_MAP.md
docs/high-land-spec.md
docs/high-land-acceptance-checklist.md
docs/deployment-hostinger.md
apps/high-land-web/
```

## Main goal

Make High Land install, test, build, package, and deploy safely at:

```txt
https://dtfseeds.com/games/high-land/
```

The game must preserve:

```txt
2 to 10 players
single continuous board path
exact dice movement
player tokens on board coordinates
HIT card spaces and card effects
skip turns, draw-again, choices, and Reverse Rotation
save/load
win condition
mobile-friendly layout
Hostinger Website Room API boundary
```

## Required repository checks

Run from the repo root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

Do not install or run Playwright for High Land. It is retired from the active validation path.

## Fix order

```txt
1. TypeScript errors
2. Unit test failures
3. Production build errors
4. Room API security / PHP lint failures
5. Asset path errors
6. Phaser render errors
7. Mobile layout errors
8. UI polish
9. Live deployment and two-device multiplayer verification
```

## Important app files

```txt
apps/high-land-web/package.json
apps/high-land-web/tsconfig.json
apps/high-land-web/vite.config.ts
apps/high-land-web/src/main.tsx
apps/high-land-web/src/App.tsx
apps/high-land-web/src/styles.css
apps/high-land-web/src/ui/PhaserBoard.tsx
apps/high-land-web/src/ui/DiceDisplay.tsx
apps/high-land-web/src/ui/CardRevealModal.tsx
apps/high-land-web/src/ui/GameRulesPanel.tsx
apps/high-land-web/src/game/HighLandGame.ts
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-web/src/game/data/boardPath.ts
apps/high-land-web/src/game/data/actionCards.ts
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
apps/high-land-web/src/game/systems/turnSystem.ts
apps/high-land-web/src/game/systems/movementSystem.ts
apps/high-land-web/src/game/systems/diceSystem.ts
apps/high-land-web/src/game/systems/storageSystem.ts
apps/high-land-web/src/game/systems/audioSystem.ts
apps/high-land-web/src/game/systems/assetPath.ts
apps/high-land-web/public/api/
```

## Rules for fixing

```txt
Keep changes small.
Prefer repairing existing files over adding parallel systems.
Do not delete working game systems.
Do not replace Phaser + React setup.
Do not remove 10-player support.
Do not commit secrets or private room data.
Do not reconnect Supabase/Firebase or introduce a second multiplayer authority.
Do not use copyrighted Candy Land art, names, board layout, or card text.
```

## Visual/game requirements

High Land must remain an adult 21+ original THC community board game with one continuous path, large colored spaces, HIT spaces, skip/choice/reverse mechanics, and a race to Cloud 9 Citadel.

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

## Manual browser/live review

After repository checks pass, manually verify:

```txt
app loads
2-player game starts
4-player game starts
10-player game starts
Roll Dice works
tokens move exact spaces
current player updates
HIT card effects resolve
skip turns work
choices resolve
Reverse Rotation works through dice turns and card turns
save/load works
winner condition works
mobile view is usable
production build works under /games/high-land/
```

Live success requires deployment of the tested `apps/high-land-web/dist` artifact and visitor-facing verification of `https://dtfseeds.com/games/high-land/`.

## Final output required

Report:

```txt
What commands passed
What files changed
What errors were fixed
What still needs assets or live credentials
Whether the repo artifact is ready to upload
Whether live /games/high-land/ verification passed, failed, or was not tested
```
