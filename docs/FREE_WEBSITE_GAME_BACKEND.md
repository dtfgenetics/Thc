# Free Website Game Backend

This repo should use the paid-for website hosting first before adding third-party realtime platforms.

Current target:

```txt
https://dtfseeds.com/games/<game-slug>/
```

Each browser game can ship a small PHP API beside the static build:

```txt
/games/<game-slug>/
  index.html
  assets/
  api/
    create-room.php
    join-room.php
    get-room.php
    update-room.php
    append-event.php
    _shared.php
    _rooms/
      .htaccess
```

## Why this structure

This avoids Supabase for the first multiplayer version. It uses the existing website as the room server and stores room state as JSON files on the host. This is good enough for turn-based board/card games where updates can be polled every 1-3 seconds.

Use this for:

- High Land
- Weedopolis
- High IQ
- Bud or Bluff
- THC U Know
- Coloring book save/share rooms if needed
- Future THC/DTF browser games

## API contract

### POST api/create-room.php

Request:

```json
{
  "game": "high-land",
  "playerName": "Host Name",
  "playerId": "optional-stable-client-id",
  "maxPlayers": 10,
  "state": null
}
```

Response:

```json
{
  "ok": true,
  "room": {
    "code": "ABC123",
    "game": "high-land",
    "status": "waiting",
    "players": [],
    "state": null,
    "events": []
  }
}
```

### POST api/join-room.php

Request:

```json
{
  "roomCode": "ABC123",
  "playerName": "Guest Name",
  "playerId": "optional-stable-client-id"
}
```

### GET api/get-room.php?room=ABC123

Returns the latest room snapshot.

### POST api/update-room.php

Request:

```json
{
  "roomCode": "ABC123",
  "playerId": "player-id",
  "status": "playing",
  "state": {
    "gameSpecific": true
  },
  "event": {
    "type": "roll",
    "value": 4
  }
}
```

### POST api/append-event.php

Request:

```json
{
  "roomCode": "ABC123",
  "playerId": "player-id",
  "event": {
    "type": "chat_or_game_event"
  }
}
```

## Frontend transport pattern

Each game should implement a transport adapter with this shape:

```ts
type WebsiteGameRoomTransport = {
  createRoom(hostPlayer): Promise<RoomState>;
  joinRoom(roomCode, player): Promise<RoomState>;
  getRoom(roomCode): Promise<RoomState>;
  updateRoom(roomCode, playerId, state): Promise<RoomState>;
  appendEvent(roomCode, playerId, event): Promise<void>;
  subscribe(roomCode, onSnapshot): () => void;
};
```

The `subscribe` method should poll `get-room.php` every 1-3 seconds for now. Do not require websockets for the first free version.

## Deployment

When `npm run build` runs for a game, everything under that game's `public/` folder should be copied into `dist/`. For High Land that means:

```txt
apps/high-land-web/public/api/*
```

becomes:

```txt
apps/high-land-web/dist/api/*
```

Upload the entire dist folder to:

```txt
/public_html/games/high-land/
```

The API will then be available at:

```txt
https://dtfseeds.com/games/high-land/api/create-room.php
https://dtfseeds.com/games/high-land/api/join-room.php
https://dtfseeds.com/games/high-land/api/get-room.php?room=ABC123
https://dtfseeds.com/games/high-land/api/update-room.php
https://dtfseeds.com/games/high-land/api/append-event.php
```

## Rules

- Keep local fallback mode working.
- Do not require Supabase for current verification.
- Do not store secrets in browser code.
- Do not make room JSON files publicly browsable.
- Keep games turn-based and poll-based until the free backend is proven stable.
- Only add MySQL later if JSON file storage becomes too limiting.

## Next implementation step

High Land already has a `RoomTransport` interface. Add a `websiteRoomTransport.ts` adapter that calls these PHP endpoints, then choose that adapter when the game is deployed on dtfseeds.com. Keep `localRoomTransport` for tests and offline development.
