# Three-Pass Game Audit

This audit identifies where the current build can fail, what structure fixes each issue, and how Codex should verify the fixes.

## Pass 1 — Does the code match the locked game plan?

### Failure 1: Player count mismatch

The docs and game goal say support up to 10 players, but the original code only allowed 2-4 players.

### Fix structure

```txt
apps/high-land-web/src/game/types/gameTypes.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/game/systems/tokenLayoutSystem.ts
apps/high-land-web/src/App.tsx
apps/high-land-server/src/rooms/GameRoom.ts
```

### Required code behavior

- Local game supports 2-10 players.
- UI exposes 2, 3, 4, 5, 6, 8, and 10 players.
- Multiplayer server uses 10 max clients.
- Tokens spread around a shared board space instead of stacking.

### Verification

- `createInitialGame(10)` returns 10 players.
- `createInitialGame(11)` throws.
- Browser can start 10-player local mode.
- Tokens remain visible when all players are on START.

## Pass 2 — Does the card system match the card sheets?

### Failure 2: HIT/action card logic is too small

The visual card sheets include effects beyond basic move/skip/roll-again. The engine needs to support color targeting, leader targeting, group movement, protection, turn reversal, and draw-again behavior.

### Fix structure

```txt
apps/high-land-web/src/game/data/actionCards.ts
apps/high-land-web/src/game/systems/targetingSystem.ts
apps/high-land-web/src/game/systems/effectResolver.ts
apps/high-land-web/src/game/systems/cardSystem.ts
```

### Required code behavior

Support these effect types:

```txt
move
skip_turns
go_to_space
swap_position
roll_again
move_to_color
move_all
move_leader
reverse_turn_order
protect_from_backward
draw_again
move_and_roll_again
```

### Verification

- A forward card moves the current player forward.
- A backward card moves them backward unless protected.
- A color card finds the next/previous matching color.
- A leader card moves the leader back.
- A group card moves more than one player.
- A protection card blocks the next backward movement.
- A reverse card changes turn direction temporarily.

## Pass 3 — Does it play smooth and look like the game we designed?

### Failure 3: Visual lock is not enforced

The current board renderer is a placeholder. The game needs to support the final uploaded board art while keeping the fallback generated board for development.

### Fix structure

```txt
apps/high-land-web/public/assets/images/board/high-land-board.png
apps/high-land-web/src/game/scenes/BoardScene.ts
docs/VISUAL_LOCK.md
docs/BOARD_COORDINATE_MAP.md
docs/ASSET_MANIFEST.md
```

### Required code behavior

- BoardScene can preload and render final board art if present.
- Generated board remains only as fallback.
- Path coordinates remain separated from visual art.
- Token movement follows `boardPath.ts`, not visual guesses.

### Verification

- Board loads without console errors.
- If final board image is missing, fallback board still renders.
- When board image is added, it displays under the interactive path/tokens.
- Tokens stay above the board and path.

## Clear handoff goal

The first real playable version is complete only when:

- 10-player local mode works.
- HIT/action cards include the full mechanical range from the sheets.
- Final board/card visuals are locked in docs and asset paths.
- Movement is smooth and cannot be spammed into broken state.
- Tests pass.
- `npm run build` succeeds.
- `dist` can be uploaded to `dtfseeds.com/games/high-land/`.
