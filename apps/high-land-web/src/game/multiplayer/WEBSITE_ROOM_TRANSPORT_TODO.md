# Website Room Transport TODO

The free website backend now exists under:

```txt
apps/high-land-web/public/api/
```

When built, Vite copies it to:

```txt
apps/high-land-web/dist/api/
```

After deployment to Hostinger, the API endpoints will be available at:

```txt
https://dtfseeds.com/games/high-land/api/create-room.php
https://dtfseeds.com/games/high-land/api/join-room.php
https://dtfseeds.com/games/high-land/api/get-room.php?room=ABC123
https://dtfseeds.com/games/high-land/api/update-room.php
https://dtfseeds.com/games/high-land/api/append-event.php
```

## Next code adapter

Add a `websiteRoomTransport.ts` file beside `localRoomTransport.ts` that implements the existing `RoomTransport` interface.

Required methods:

```ts
createRoom(hostPlayer)
joinRoom(roomCode, player)
updateGameState(roomCode, gameState)
appendEvent(roomCode, event)
subscribe(roomCode, onSnapshot)
```

Implementation rules:

- Use `fetch` to call the PHP endpoints.
- Convert PHP room payload `state` into High Land `gameState`.
- Convert PHP `players` into `HighLandRoomPlayer[]`.
- Poll `get-room.php` every 1-3 seconds inside `subscribe`.
- Keep `localRoomTransport` as the default for tests and offline dev.
- Only enable website transport when deployed to dtfseeds.com or when an explicit config flag is set.
- Do not require Supabase.

## Payload mapping

PHP room payload:

```ts
type WebsiteRoomPayload = {
  code: string;
  game: string;
  status: 'waiting' | 'playing' | 'complete';
  players: HighLandRoomPlayer[];
  state: GameState | null;
  createdAt: string;
  updatedAt: string;
};
```

High Land room state:

```ts
type HighLandRoomState = {
  id: string;
  code: string;
  status: 'waiting' | 'playing' | 'complete' | 'abandoned';
  hostPlayerId: string;
  players: HighLandRoomPlayer[];
  gameState: GameState | null;
  createdAt: string;
  updatedAt: string;
};
```

Mapping:

```txt
WebsiteRoomPayload.code -> HighLandRoomState.id and code
WebsiteRoomPayload.state -> HighLandRoomState.gameState
First player with host=true -> HighLandRoomState.hostPlayerId
```
