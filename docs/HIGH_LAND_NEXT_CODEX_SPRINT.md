# High Land Next Codex Sprint

Use this as the immediate execution checklist after the systems scaffold.

## Sprint goal

Turn the current High Land prototype into a named-player, room-ready browser game without breaking local play.

## Current safe starter files

```txt
apps/high-land-web/src/app/appModes.ts
apps/high-land-web/src/app/gameRouteState.ts
apps/high-land-web/src/game/players/playerIdentity.ts
apps/high-land-web/src/game/multiplayer/roomCodes.ts
apps/high-land-web/src/game/multiplayer/inviteLinks.ts
apps/high-land-web/src/game/multiplayer/roomState.ts
apps/high-land-web/src/game/multiplayer/localRoomStorage.ts
apps/high-land-web/src/game/multiplayer/localRoomRepository.ts
apps/high-land-web/src/game/multiplayer/supabaseClient.ts
apps/high-land-web/src/game/events/gameEvents.ts
apps/high-land-web/src/game/events/eventReducer.ts
apps/high-land-web/src/game/board/boardCalibration.ts
apps/high-land-web/src/game/board/boardCoordinateValidator.ts
apps/high-land-web/src/game/assets/highLandAssetManifest.ts
apps/high-land-web/src/game/assets/assetPreflight.ts
apps/high-land-web/src/ui/PlayerSetupForm.tsx
apps/high-land-web/src/ui/RoomLobby.tsx
```

## Order of work

### Step 1 — Verify baseline

Run:

```bash
npm install
npm run test:high-land
npm run build:high-land
```

Fix compile/test errors before wiring UI.

### Step 2 — Wire local named-player setup

Use:

```txt
PlayerSetupForm.tsx
playerIdentity.ts
appModes.ts
```

Acceptance:

```txt
- User sees setup before gameplay.
- Name is required.
- Local game still supports 2-10 players.
- First player uses entered name.
- Current dice, board, cards, audio, save/load still work.
```

### Step 3 — Wire local room lobby

Use:

```txt
RoomLobby.tsx
localRoomRepository.ts
inviteLinks.ts
roomCodes.ts
roomState.ts
```

Acceptance:

```txt
- Host can create a local room.
- Invite link is generated.
- Join screen can parse ?room=CODE.
- Lobby shows joined players.
- Host can start after at least 2 players.
```

This is still same-device/local fallback until Supabase is connected.

### Step 4 — Prepare live Supabase multiplayer

Use:

```txt
docs/HIGH_LAND_SUPABASE_SCHEMA_DRAFT.md
supabaseClient.ts
```

Acceptance:

```txt
- Missing Supabase env vars do not crash local play.
- Real Supabase client is added only after env vars and schema are approved.
- No service-role key is used in browser code.
```

### Step 5 — Production runtime verification

Verify:

```txt
https://dtfseeds.com/games/high-land/
```

Acceptance:

```txt
- Page loads.
- Phaser canvas appears.
- Board art or fallback board appears.
- Assets load under /games/high-land/.
- No console errors.
- Mobile viewport remains playable.
```

## Do not do

```txt
Do not replace the game with a generic demo.
Do not mix in High IQ, Weedopolis, Bud or Bluff, THC U Know, or other games.
Do not commit secrets.
Do not remove read_only=true from .mcp.json until schema work is approved.
Do not claim multiplayer is done until two browsers share one room state.
```

## Report format

Codex should report:

```txt
Files changed:
Tests run:
Build status:
What works:
What is still local-only:
What needs Supabase dashboard setup:
What needs Hostinger/WordPress verification:
Next recommended issue:
```
