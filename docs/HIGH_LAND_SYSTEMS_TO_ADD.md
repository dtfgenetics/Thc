# High Land Systems Expansion Plan

This file defines the next systems to add to **High Land: The Sweet Escape** so Codex can grow the application without breaking the existing playable prototype.

Repository source of truth:

```txt
dtfgenetics/Thc
```

Application path:

```txt
apps/high-land-web
```

Production route:

```txt
https://dtfseeds.com/games/high-land/
```

## Rule

Do not replace High Land with a generic demo. Do not mix in High IQ, Weedopolis, Strain Showdown, Bud or Bluff, THC U Know, or other games.

## Systems to add

### 1. App Mode System

Purpose: separate app flow from game rules.

Required modes:

```txt
landing
local_setup
create_room
join_room
lobby
playing
game_over
```

Files:

```txt
apps/high-land-web/src/app/appModes.ts
apps/high-land-web/src/app/gameRouteState.ts
```

Acceptance:

- The user can choose local play or room play.
- Room flow requires a player name.
- Game rules do not depend directly on React screen state.

### 2. Player Identity System

Purpose: make players real named participants instead of generic player-count slots.

Files:

```txt
apps/high-land-web/src/game/players/playerIdentity.ts
```

Acceptance:

- Names are trimmed and validated.
- Empty names are rejected.
- A local guest id is created and reused.
- Token assignment stays deterministic.

### 3. Room / Invite System

Purpose: support Hostinger Website Room API multiplayer.

Files:

```txt
apps/high-land-web/src/game/multiplayer/roomCodes.ts
apps/high-land-web/src/game/multiplayer/inviteLinks.ts
apps/high-land-web/src/game/multiplayer/roomState.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
```

Acceptance:

- Host can generate a short room code.
- Invite URLs can be created and parsed.
- Missing/unavailable website API produces a safe disconnected state, not a crash.
- Browser-safe env variables only:

No browser API credential is required because the room API is same-origin.

Never commit service-role keys, database passwords, Hostinger keys, Discord tokens, OpenAI keys, or GitHub tokens.

### 4. Game Event Log System

Purpose: make game changes replayable, syncable, and debuggable.

Files:

```txt
apps/high-land-web/src/game/events/gameEvents.ts
apps/high-land-web/src/game/events/eventReducer.ts
```

Event names:

```txt
room_created
player_joined
game_started
dice_rolled
player_moved
hit_card_drawn
skip_turn_applied
winner_declared
```

Acceptance:

- Every multiplayer state change can be described by an event.
- Events include enough payload data to debug what happened.
- Events are serializable for Website Room API storage.

### 5. Board Calibration System

Purpose: prove that token coordinates match the visible board path.

Files:

```txt
apps/high-land-web/src/game/board/boardCalibration.ts
apps/high-land-web/src/game/board/boardCoordinateValidator.ts
```

Acceptance:

- Path indexes are continuous.
- No duplicate indexes.
- Every coordinate is inside the board bounds.
- Start and finish exist.
- Tests fail if coordinates are invalid.

### 6. Asset Manifest System

Purpose: stop silent failures on dtfseeds.com when art/audio paths are missing.

Files:

```txt
apps/high-land-web/src/game/assets/highLandAssetManifest.ts
apps/high-land-web/src/game/assets/assetPreflight.ts
```

Required asset groups:

```txt
board
path overlay
player tokens
HIT cards
dice
audio
ui
```

Acceptance:

- Required assets are listed in one manifest.
- The app can report missing placeholders without crashing.
- No fake checkerboard transparency assets.

### 7. Website Room Storage System

Purpose: prepare persistent multiplayer sessions.

Future tables:

```txt
game_sessions
game_players
game_invites
high_land_turns
high_land_events
```

Acceptance:

- Use migrations.
- Enable RLS on public tables.
- Do not remove `read_only=true` from `.mcp.json` until schema changes are approved.
- Do not expose private keys to frontend code.

### 8. Runtime Verification System

Purpose: verify the actual deployed game, not just static HTML.

Codex must check:

```txt
- /games/high-land/ loads without console errors
- Vite assets resolve under /games/high-land/
- Phaser canvas appears
- board art loads or fallback renders
- token positions render on board path
- mute/unmute works
- mobile viewport keeps the board usable
```

## Codex execution order

1. Add starter systems without changing current gameplay.
2. Add tests for pure systems first.
3. Wire player naming into setup.
4. Add room code and invite parsing.
5. Add Website Room API client with offline fallback.
6. Verify room storage authorization, locking, cleanup, and privacy.
7. Wire shared room state.
8. Test two-browser multiplayer.
9. Verify production route.

## Required commands

```bash
npm install
npm run test:high-land
npm run build:high-land
```

## Definition of ready for next deployment

High Land is not ready to mark complete until:

- Named player setup works.
- A room can be created.
- A second browser can join by invite link/code.
- Only the active player can roll.
- Dice movement visually matches the board path.
- Tokens sit on spaces, not in a side panel.
- HIT cards and skip turns work.
- Winner popup appears.
- Audio works and can be muted.
- Build and tests pass.
- Production assets load from `/games/high-land/`.
