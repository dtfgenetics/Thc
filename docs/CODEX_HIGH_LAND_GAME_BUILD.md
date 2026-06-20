# Codex Handoff: High Land Browser Game Build

This file is the source-of-truth handoff for building **High Land: The Sweet Escape** as a browser-based game for the DTF / THC web ecosystem.

Repository: `dtfgenetics/Thc`

Primary website target: `dtfseeds.com`

Secondary/brand ecosystem target: `dtf420.com` if needed later.

---

## 1. Project Goal

Build a playable browser game based on our physical board game concept **High Land: The Sweet Escape**.

The game is a cannabis-themed adult parody board game for the THC community. It should feel like a candy-land-style path game, but the implementation must use original art, original naming, and original mechanics. Do not copy protected Candy Land art, logos, names, board layout, cards, or wording.

The digital version must support:

- 2-4 players initially.
- Local pass-and-play first.
- Online multiplayer after local rules are stable.
- Dice rolling.
- Turn order.
- Skip turns.
- Player movement animations.
- Action / HIT cards.
- Forward and backward card movement.
- Board spaces with special effects.
- Background music and sound effects.
- Mobile-friendly browser play.
- Embedding or routing from the WordPress website.
- Clean handoff for Codex to keep improving without replacing the actual game with the wrong code.

---

## 2. Important Rule: Do Not Replace This With a Generic Game

Past attempts loaded or restored the wrong game. This must not happen again.

Codex must preserve these locked concepts:

- Game name: **High Land: The Sweet Escape**.
- Theme: adult 21+ THC community parody/fantasy board game.
- Core mechanic: dice roll + path movement + HIT/action cards.
- Board style: fantasy world with a continuous candy-land-style colored path.
- Path rule: one single continuous path; no disconnected route pieces; no alternate route unless explicitly added later.
- Board locations must appear in this order:
  1. Rolling Hills
  2. Dankwood Forest
  3. Rosin Rail Station
  4. Munchie Mountain
  5. Kief Caves
  6. Trichome Towers
  7. Cloud 9 Citadel
- HIT/action cards are for High Land.
- Do not mix this with Strain Showdown, High IQ, Weedopolis, Bud or Bluff, or THC U Know.

---

## 3. Recommended Tech Stack

Use this stack unless there is a strong technical reason not to:

### Frontend Game Layer

Use **Vite + TypeScript + Phaser**.

Reason:

- Phaser is built for 2D browser games.
- It supports WebGL and Canvas rendering.
- It fits animated board/token movement better than plain React DOM.
- It can still be embedded into a React/WordPress page as a canvas-based game.

### UI Shell

Use **React + TypeScript** around Phaser for:

- Main menu.
- Lobby screen.
- Game setup.
- Rules/help modal.
- Player names.
- Audio settings.
- Mobile overlay buttons.
- End-game screen.

### Audio

Use **howler.js** for:

- Background loop.
- Dice roll sound.
- Card draw sound.
- Move tick sounds.
- HIT card effect sound.
- Win sound.
- Mute/unmute controls.

### Multiplayer

Use **Colyseus** for online multiplayer after the local game is working.

Reason:

- It is designed for authoritative Node.js game servers.
- It handles rooms, matchmaking, state synchronization, and client/server messaging.
- It is a better long-term fit than trying to make WordPress handle live multiplayer state.

### First Build Order

Do not start with multiplayer. Build in this order:

1. Static board render.
2. Local player tokens.
3. Dice roll.
4. Turn system.
5. Movement animation.
6. HIT/action cards.
7. Special board spaces.
8. Local win condition.
9. Save/restart state.
10. Online multiplayer with Colyseus.
11. WordPress embed/routing.

---

## 4. Suggested Repo Structure

Create this structure:

```txt
/
  README.md
  package.json
  pnpm-workspace.yaml
  apps/
    high-land-web/
      index.html
      package.json
      vite.config.ts
      src/
        main.tsx
        App.tsx
        game/
          HighLandGame.ts
          scenes/
            BootScene.ts
            PreloadScene.ts
            MenuScene.ts
            BoardScene.ts
            UIScene.ts
            ResultsScene.ts
          systems/
            turnSystem.ts
            diceSystem.ts
            movementSystem.ts
            cardSystem.ts
            boardSpaceSystem.ts
            audioSystem.ts
            animationSystem.ts
          data/
            boardPath.ts
            hitCards.ts
            boardSpaces.ts
            players.ts
          types/
            gameTypes.ts
          assets/
            images/
            audio/
            fonts/
        ui/
          components/
          styles/
    high-land-server/
      package.json
      src/
        index.ts
        rooms/
          HighLandRoom.ts
          HighLandState.ts
        systems/
          serverTurnSystem.ts
          serverCardSystem.ts
          serverMovementSystem.ts
  packages/
    shared-game-rules/
      package.json
      src/
        index.ts
        rules.ts
        cards.ts
        board.ts
        validation.ts
  docs/
    CODEX_HIGH_LAND_GAME_BUILD.md
    HIGH_LAND_RULES.md
    ASSET_MANIFEST.md
    TEST_PLAN.md
```

If Codex starts smaller, it may create only `apps/high-land-web` first, but the rules/data should still be separated so the multiplayer server can reuse them later.

---

## 5. Game Data Model

Create typed data, not hardcoded random logic scattered through components.

### Player

```ts
export type Player = {
  id: string;
  name: string;
  token: string;
  color: string;
  positionIndex: number;
  skipTurns: number;
  isConnected?: boolean;
};
```

### Board Space

```ts
export type BoardSpace = {
  index: number;
  label?: string;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'special';
  location?:
    | 'Rolling Hills'
    | 'Dankwood Forest'
    | 'Rosin Rail Station'
    | 'Munchie Mountain'
    | 'Kief Caves'
    | 'Trichome Towers'
    | 'Cloud 9 Citadel';
  type: 'normal' | 'hit' | 'skip' | 'shortcut' | 'start' | 'finish';
  x: number;
  y: number;
};
```

### HIT / Action Card

```ts
export type HitCard = {
  id: string;
  title: string;
  text: string;
  effect:
    | { type: 'move'; amount: number }
    | { type: 'skip_turns'; amount: number }
    | { type: 'go_to_space'; index: number }
    | { type: 'swap_position'; target: 'leader' | 'random' }
    | { type: 'roll_again' };
};
```

---

## 6. Core Rules To Implement

### Game Setup

- 2-4 players.
- Each player chooses a token/color.
- All players start at index `0`.
- Randomize or manually choose first player.

### Turn Flow

Each turn:

1. Check if current player has `skipTurns > 0`.
2. If skipped, reduce skip counter and advance turn.
3. If not skipped, player rolls dice.
4. Move player forward by dice value.
5. Animate token along each path space, not a single teleport.
6. Resolve landed space.
7. If landed on HIT space, draw HIT/action card.
8. Resolve card effect.
9. Check win condition.
10. Advance turn.

### Dice

- Start with one six-sided die.
- Dice result must be visible in UI.
- Dice animation is required.
- Dice result must be deterministic from game state when multiplayer is added.

### Movement

- Movement follows `boardPath.ts` index order.
- Players cannot move off-path.
- If movement goes past final index, either clamp to finish or require exact roll. Choose clamp-to-finish for first build.
- Backward movement cannot go below index `0`.

### HIT Cards

Minimum starting deck:

```ts
export const starterHitCards: HitCard[] = [
  { id: 'hit-001', title: 'Cloud Boost', text: 'Float ahead 3 spaces.', effect: { type: 'move', amount: 3 } },
  { id: 'hit-002', title: 'Snack Detour', text: 'Move back 2 spaces.', effect: { type: 'move', amount: -2 } },
  { id: 'hit-003', title: 'Rolling Momentum', text: 'Roll again.', effect: { type: 'roll_again' } },
  { id: 'hit-004', title: 'Sticky Rosin Trap', text: 'Skip your next turn.', effect: { type: 'skip_turns', amount: 1 } },
  { id: 'hit-005', title: 'Kief Cave Shortcut', text: 'Jump ahead 5 spaces.', effect: { type: 'move', amount: 5 } },
  { id: 'hit-006', title: 'Munchie Crash', text: 'Move back 4 spaces.', effect: { type: 'move', amount: -4 } }
];
```

Add more cards later, but first make this starter deck work perfectly.

---

## 7. Board Requirements

### Visual Board

The board should be rendered from assets, not generated randomly.

Required visual areas:

1. **Rolling Hills** — joints everywhere, colorful rolling hills, early-game friendly zone.
2. **Dankwood Forest** — massive cannabis plants, giant forest scale, middle fantasy danger zone.
3. **Rosin Rail Station** — sticky amber/gold resin, glossy rails/station, warm lighting.
4. **Munchie Mountain** — candy/food mountain, bright chaotic snack landscape.
5. **Kief Caves** — underground cave area, dusty crystal/kief feel.
6. **Trichome Towers** — crystalline trichome towers, late-game premium fantasy area.
7. **Cloud 9 Citadel** — cloud castle/citadel finish zone.

### Path Rules

- The path must be a single continuous sequence.
- Each colored square must visibly touch the next square.
- No disconnected path chunks.
- No accidental alternate paths.
- No confusing white gaps between path sections.
- The path should have a thick white edging/border.
- Colors should be bold: red, yellow, green, blue, purple.
- Include special HIT spaces.
- Include clear START and FINISH spaces.

### Board Data

`boardPath.ts` must contain each playable coordinate in order:

```ts
export const boardPath = [
  { index: 0, x: 120, y: 720, color: 'special', type: 'start' },
  { index: 1, x: 170, y: 700, color: 'red', type: 'normal' },
  { index: 2, x: 220, y: 685, color: 'yellow', type: 'normal' }
  // Continue until finish...
];
```

Codex must wire the visual board and the path coordinates together. Do not just draw tokens randomly over the image.

---

## 8. Missing Assets Checklist

Create placeholders first, then replace with final art.

Required image assets:

- Full board background.
- Transparent board path overlay if separate from board background.
- Player tokens, at least 4.
- Dice sprite or dice face images 1-6.
- HIT card back.
- HIT card front template.
- START marker.
- FINISH marker.
- Location badges/icons for all 7 areas.
- UI buttons.
- Loading screen/logo.

Required audio assets:

- Background loop.
- Dice roll sound.
- Token move tick sound.
- Card draw sound.
- Positive card sound.
- Negative card sound.
- Skip-turn sound.
- Victory sound.

Rules for assets:

- Use real transparent PNGs when transparency is required.
- Never fake transparency with a checkerboard background.
- Keep placeholders clearly named with `placeholder-` prefix.
- Document every asset in `docs/ASSET_MANIFEST.md`.

---

## 9. WordPress / Website Integration

Do not build this as a WordPress plugin first. Build it as a standalone static web app, then embed or route it into WordPress.

Preferred deployment path:

1. Build the game with Vite.
2. Output static files from `apps/high-land-web/dist`.
3. Upload static build to a subdirectory such as:

```txt
/games/high-land/
```

4. Link to it from WordPress page/menu.
5. If needed, embed in an iframe only after standalone loading works.

Do not require WordPress/PHP for core gameplay.

For multiplayer later, the Colyseus server must be hosted separately from WordPress unless the host supports Node.js processes reliably.

---

## 10. Multiplayer Plan

Do not let clients decide final game state in multiplayer.

Use authoritative server logic:

- Server owns dice result.
- Server owns deck order.
- Server owns turn order.
- Server owns player positions.
- Server validates card effects.
- Clients only send allowed actions: `rollDice`, `drawCard`, `selectToken`, `ready`, etc.

Room state should include:

```ts
export type HighLandRoomState = {
  gameId: string;
  players: Record<string, Player>;
  currentPlayerId: string;
  phase: 'lobby' | 'rolling' | 'moving' | 'resolving_card' | 'game_over';
  boardPathLength: number;
  hitDeckSeed: string;
  discardPile: string[];
  winnerId?: string;
};
```

Minimum multiplayer features:

- Create room.
- Join room code.
- Ready up.
- Start game.
- Reconnect grace period.
- Host can restart room.

---

## 11. Testing Requirements

Create tests before declaring the game playable.

### Unit Tests

Test these systems:

- Dice result range is 1-6.
- Movement clamps at start and finish.
- Skip turn decreases correctly.
- Turn advances correctly.
- HIT card move forward works.
- HIT card move backward works.
- Roll again does not skip the same player.
- Finish condition triggers winner.
- Board path indexes are continuous.
- Every path coordinate has x/y values.

### Browser / Play Tests

Use Playwright or equivalent.

Required browser checks:

- Game loads.
- Start menu appears.
- Player setup works.
- Dice button works.
- Token moves after roll.
- HIT card modal appears on HIT spaces.
- Game can reach finish.
- Mute/unmute works.
- Mobile viewport does not break layout.

### Manual QA Checklist

Before handoff, verify:

- No wrong game loaded.
- Board path is continuous.
- Tokens are visible above the board.
- Dice roll cannot be spammed during animation.
- Turn cannot advance during unresolved card effect.
- Game works after refresh/restart.
- Audio can be muted.
- No console errors.

---

## 12. Current Build Phases

### Phase 1 — Local Prototype

Deliverable:

- Playable local pass-and-play game.
- Placeholder board accepted.
- No multiplayer yet.

Acceptance criteria:

- 2-4 players can play from start to finish.
- Dice, turns, movement, HIT cards, skip turns, and win condition work.
- Game does not use the wrong mechanics from other THC games.

### Phase 2 — Real Art Integration

Deliverable:

- Real High Land board art.
- Real tokens.
- Real card visuals.
- Polished animations and audio.

Acceptance criteria:

- Board matches the locked High Land map concept.
- Path remains continuous.
- All major locations are visible and in correct order.

### Phase 3 — Online Multiplayer

Deliverable:

- Colyseus multiplayer room.
- Server-authoritative turns and dice.
- Join/share room code.

Acceptance criteria:

- Two browsers can join and play.
- State sync works.
- Refresh/reconnect does not destroy the room immediately.

### Phase 4 — Website Deployment

Deliverable:

- Static build hosted under `dtfseeds.com/games/high-land/` or equivalent.
- WordPress page links to the game.
- Mobile playable.

Acceptance criteria:

- Public URL loads.
- No broken asset paths.
- Audio settings work.
- Game can be shared and tested by others.

---

## 13. Codex Guardrails

Codex must not:

- Replace the game with a generic board game template.
- Remove the High Land theme.
- Confuse High Land with High IQ, Strain Showdown, Weedopolis, Bud or Bluff, or THC U Know.
- Use fake transparent checkerboard assets.
- Hardcode random path movement disconnected from board coordinates.
- Add multiplayer before local game rules are stable.
- Put core game state inside WordPress/PHP.
- Rely on client-only multiplayer state.
- Copy Candy Land protected art or branding.

Codex should:

- Build small working slices.
- Add tests with each slice.
- Keep rules in shared files.
- Keep visual rendering separate from game logic.
- Make every asset path explicit.
- Document all placeholder assets.
- Commit changes in logical steps.

---

## 14. First Codex Task Prompt

Use this prompt to start the build:

```txt
We are building High Land: The Sweet Escape in repo dtfgenetics/Thc.

Read docs/CODEX_HIGH_LAND_GAME_BUILD.md first and treat it as the source of truth.

Create a Vite + React + TypeScript + Phaser local prototype in apps/high-land-web.

Do not build multiplayer yet.

Implement:
- 2-4 local players
- player setup screen
- static placeholder board
- continuous boardPath data file
- visible tokens
- one six-sided dice roll
- animated movement along boardPath indexes
- turn order
- skip-turn support
- HIT card deck with forward/back/skip/roll-again effects
- win condition at final board index
- mute/unmute control
- basic tests for dice, movement, turn, card, and boardPath validation

Keep game rules separate from rendering so we can add Colyseus multiplayer later.

Do not replace this with another game or import unrelated old game code.
```

---

## 15. Reference Docs Consulted

- Phaser docs: https://docs.phaser.io/phaser/getting-started/what-is-phaser
- Colyseus docs: https://docs.colyseus.io/
- howler.js docs: https://howlerjs.com/
