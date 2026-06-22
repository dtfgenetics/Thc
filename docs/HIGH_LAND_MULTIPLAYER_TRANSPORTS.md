# High Land Multiplayer Transports

High Land now has a transport boundary so the app can move from local fallback to live Supabase multiplayer without a rewrite.

## Current files

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/supabaseRoomTransport.ts
```

## Transport roles

### roomTransport.ts

Shared contract.

Defines:

```txt
createRoom
joinRoom
updateGameState
appendEvent
subscribe
```

Also provides `createOfflineRoomTransport()` so unfinished network transports fail safely.

### localRoomTransport.ts

Works now.

Uses local storage so development can test room creation, joining, game-state updates, and snapshot reads without Supabase.

Use this for:

```txt
local fallback
UI development
room and lobby testing
non-production multiplayer simulation
```

### supabaseRoomTransport.ts

Safe stub.

Checks whether Supabase frontend env vars exist. It does not claim live sync is complete. It returns an offline transport until real Supabase room sync is implemented.

Use this later for:

```txt
production multiplayer
schema-backed rooms
realtime sync
multi-browser sessions
```

## Do not do

```txt
Do not commit service-role keys.
Do not put database passwords in VITE env vars.
Do not claim multiplayer is done while supabaseRoomTransport is still a stub.
Do not remove read_only=true from .mcp.json until schema/migration work is approved.
```

## Next implementation order

```txt
1. Use localRoomTransport in App for the lobby fallback.
2. Convert the schema draft into a reviewed Supabase migration.
3. Implement createRoom and joinRoom against Supabase tables.
4. Implement subscribe with Supabase Realtime.
5. Test two browsers joining one room.
6. Only then call multiplayer production-ready.
```
