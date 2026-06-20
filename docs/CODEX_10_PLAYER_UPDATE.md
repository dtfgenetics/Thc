# Codex 10 Player Update

The target player count is now up to 10 players.

Codex must update the app code accordingly.

## Required source updates

Update these files:

```txt
apps/high-land-web/src/game/types/gameTypes.ts
apps/high-land-web/src/game/systems/playerSystem.ts
apps/high-land-web/src/App.tsx
apps/high-land-web/src/game/scenes/BoardScene.ts
apps/high-land-server/src/rooms/GameRoom.ts
apps/high-land-web/src/game/systems/gameEngine.test.ts
```

## Exact requirements

### gameTypes.ts

Expand `PlayerToken` from 4 values to 10 values:

```ts
tokenA through tokenJ
```

### playerSystem.ts

Set:

```ts
export const minPlayers = 2;
export const maxPlayers = 10;
```

Use 10 token colors.

### App.tsx

Change player options to:

```ts
const playerOptions = [2, 3, 4, 5, 6, 8, 10];
```

### BoardScene.ts

Replace fixed 4-player offset logic with radial offsets around each board space.

Use this idea:

```ts
function tokenOffset(playerIndex: number, playerCount: number) {
  if (playerCount <= 1) return { x: 0, y: 0 };
  const radius = playerCount <= 4 ? 14 : 22;
  const angle = (Math.PI * 2 * playerIndex) / playerCount;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
```

### GameRoom.ts

Set:

```ts
const maxPlayers = 10;
```

Add 10 default colors.

### Tests

Add test coverage proving:

- 10 players can be created.
- 11 players throws.
- 10-player game can roll without crashing.

## 10-player UX rules

- Current player must be visually obvious.
- Player chips should wrap or scroll.
- Token labels must show 1-10.
- Multiple tokens on one space must not fully overlap.
- Add fast animation option later.

## Do not do yet

- Do not add multiplayer client until local mode passes.
- Do not add chat/emotes until core game is stable.
- Do not change the board game into a different game.
