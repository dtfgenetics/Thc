# Code Sources and Execution Map

This document tells Codex what outside code to use as reference, what code already exists in this repo, and what to build next for the browser game that will live on dtfseeds.com.

## Goal

Get the game to an almost fully coded local browser version first. Multiplayer comes after the local game is stable.

## Source code references

### 1. Phaser Vite TypeScript template

Repository: https://github.com/phaserjs/template-vite-ts

Use for:

- Vite project setup
- TypeScript setup
- Phaser scene structure
- production build pattern
- asset loading structure

Do not blindly copy the template scripts. Keep this repo's scripts simple.

### 2. Colyseus Phaser tutorial

Repository: https://github.com/colyseus/tutorial-phaser

Use for:

- future multiplayer server/client split
- room setup
- WebSocket game server pattern
- authoritative state sync concepts

Do not add multiplayer until local gameplay is tested.

### 3. boardgame.io

Repository: https://github.com/boardgameio/boardgame.io

Use for:

- turn-based rules inspiration
- move validation ideas
- lobby/matchmaking concepts

Do not use it as the main rendering engine. Phaser is the main renderer.

### 4. howler.js

Repository: https://github.com/goldfire/howler.js

Use for:

- music loop
- dice roll sound
- card draw sound
- movement tick sounds
- mute/unmute and volume control

The current prototype uses simple generated tones so the game can run before final audio assets exist. Replace that with howler.js when final audio files are added.

## Current repo code already added

Current local app path:

```txt
apps/high-land-web
```

Important files:

```txt
apps/high-land-web/src/App.tsx
apps/high-land-web/src/game/HighLandGame.ts
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-web/src/game/data/boardPath.ts
apps/high-land-web/src/game/data/actionCards.ts
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/diceSystem.ts
apps/high-land-web/src/game/systems/movementSystem.ts
apps/high-land-web/src/game/systems/cardSystem.ts
apps/high-land-web/src/game/systems/turnSystem.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/game/systems/audioSystem.ts
apps/high-land-web/src/game/systems/storageSystem.ts
apps/high-land-web/src/game/systems/gameEngine.test.ts
```

## Codex execution order

Codex must execute in this order:

1. Install dependencies in `apps/high-land-web`.
2. Run tests.
3. Fix TypeScript/build errors.
4. Run the local dev server.
5. Verify the board renders.
6. Verify 2, 3, and 4 player setup.
7. Verify dice roll.
8. Verify tokens animate along path spaces.
9. Verify action card spaces trigger card effects.
10. Verify skip spaces work.
11. Verify finish/win condition.
12. Add polished image/audio assets.
13. Add deployment build for dtfseeds.com.
14. Only then add multiplayer.

## Local commands

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npm run dev
```

## Website deployment target

Build output:

```txt
apps/high-land-web/dist
```

Upload the contents of `dist` to:

```txt
dtfseeds.com/games/high-land/
```

The game should be linked from WordPress as a static browser game. Do not make WordPress run the game logic.

## Do not do these

- Do not replace this with a generic board game.
- Do not import old broken site code unless it is confirmed to be the correct game.
- Do not mix in unrelated THC games.
- Do not add online multiplayer before local rules pass.
- Do not use copyrighted Candy Land art, names, board layout, or card text.
- Do not use fake transparent checkerboard assets.

## Next code still needed

- Replace placeholder board with final board image.
- Add real token art.
- Add real action card art.
- Replace generated audio tones with actual howler.js audio files.
- Add a polished loading screen.
- Add local save/load into the UI.
- Add browser end-to-end tests.
- Add Colyseus server after local pass-and-play is stable.
