# GitHub Reference Resources for Codex

Use these repositories as references only. Do not copy whole projects into High Land, and do not replace the current app. Check licenses before copying any code.

## Primary structure references

### Phaser React TypeScript template

Repository: `phaserjs/template-react-ts`

Use for:

- React + Phaser integration patterns
- Vite app structure
- Phaser scene lifecycle
- Asset loading patterns

Apply to:

```txt
apps/high-land-web/src/ui/PhaserBoard.tsx
apps/high-land-web/src/game/HighLandGame.ts
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-web/vite.config.ts
```

### Phaser Vite TypeScript template

Repository: `phaserjs/template-vite-ts`

Use for:

- Vite + Phaser build behavior
- static asset placement
- production output checks

Apply to:

```txt
apps/high-land-web/public/assets/
apps/high-land-web/vite.config.ts
apps/high-land-web/package.json
```

## Multiplayer reference, later only

### Colyseus Phaser tutorial

Repository: `colyseus/tutorial-phaser`

Use later for:

- room join flow
- server-owned state
- reconnect ideas
- Phaser client syncing to server state

Do not use until the local browser game passes install, tests, build, browser tests, and manual playtest.

Apply later to:

```txt
apps/high-land-server/
apps/high-land-web/src/game/multiplayer/
packages/high-land-rules/
```

## Turn-based rules reference

### boardgame.io

Repository: `boardgameio/boardgame.io`

Use for concepts only:

- turn order
- phases
- move validation
- server-authoritative rules

Do not replace the current High Land rules engine with boardgame.io during the first playable build.

Apply concepts to:

```txt
apps/high-land-web/src/game/systems/gameEngine.ts
apps/high-land-web/src/game/systems/turnSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
```

## Audio reference, later only

### howler.js

Repository: `goldfire/howler.js`

Use later for:

- looping background music
- dice roll sound
- card draw sound
- win sound
- mute/unmute handling

Do not add this dependency until real audio files are added.

Apply later to:

```txt
apps/high-land-web/src/game/systems/audioSystem.ts
apps/high-land-web/public/assets/audio/
```

## Browser testing reference

### Playwright

Repository: `microsoft/playwright`

Use for:

- browser smoke tests
- mobile viewport checks
- production preview tests

Apply to:

```txt
apps/high-land-web/playwright.config.ts
apps/high-land-web/e2e/high-land.spec.ts
.github/workflows/high-land-web.yml
```

## Dice polish reference, optional later

### Dice Box

Repository: `3d-dice/dice-box`

Use later for optional 3D dice only after the simple DiceDisplay works and tests pass.

Apply later to:

```txt
apps/high-land-web/src/ui/DiceDisplay.tsx
```

## Current priority

1. Do not add dependencies yet.
2. Run install, tests, build, and browser tests.
3. Fix TypeScript and runtime errors first.
4. Add final board and card assets.
5. Calibrate board coordinates.
6. Only then add multiplayer, audio polish, or 3D dice.
