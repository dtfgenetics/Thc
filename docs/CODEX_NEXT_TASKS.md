# Codex Next Tasks

Use this checklist exactly. Work from top to bottom.

## 1. Prove the local app runs

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npm run dev
```

Fix any TypeScript or dependency errors before adding features.

## 2. Validate current gameplay

Check all of these in the browser:

- app loads
- board renders
- 2 player game works
- 3 player game works
- 4 player game works
- roll button moves current player
- turn changes after a normal move
- card spaces trigger card effects
- skip spaces add a skipped turn
- skipped turn passes correctly
- final space declares winner
- restart works
- mute/unmute works
- mobile layout is usable

## 3. Fix likely first-pass issues

Look at these files first:

```txt
apps/high-land-web/src/App.tsx
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/gameEngine.test.ts
```

Expected fixes may include:

- TypeScript config issue
- Phaser tween timeline syntax
- React strict-mode double mount behavior
- audio typing for `webkitAudioContext`
- card effect turn order edge cases
- UI needing save/load buttons

## 4. Add missing local-game features

Add in this order:

1. Save/load buttons using `storageSystem.ts`.
2. Dice visual animation.
3. Card draw modal.
4. Better action card deck.
5. More board path spaces if needed.
6. Real board image loading support.
7. Token image loading support.
8. Real audio file support.
9. End-game screen.
10. Playwright smoke test.

## 5. Prepare dtfseeds.com deployment

Read:

```txt
docs/DTFSEEDS_DEPLOYMENT.md
```

Then confirm:

- `npm run build` succeeds.
- `dist` folder has index and assets.
- asset paths are relative and work under `/games/high-land/`.
- no route depends on dev server only.

## 6. Only then wire multiplayer

Read:

```txt
docs/MULTIPLAYER_PLAN.md
```

Do not connect the multiplayer client until the local game is working.

## 7. Definition of done for first playable version

The first playable version is done only when:

- two players can complete a full game locally
- at least one action card moves forward
- at least one action card moves backward
- at least one card/space causes a skipped turn
- player positions remain visible
- browser console has no major errors
- mobile viewport works
- build output can be uploaded to dtfseeds.com
