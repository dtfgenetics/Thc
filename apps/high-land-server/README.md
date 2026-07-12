# High Land Multiplayer Server

This service provides the first server-authoritative multiplayer foundation for High Land.

## Run locally

```bash
npm install
npm run dev:server
```

The default address is `http://localhost:2567`.

## Verify

```bash
npm run test:server
```

The server test suite covers room creation, joining, readiness, host-only start, active turns, duplicate actions, reconnect sessions, the 109-space board, all 39 HIT-card definitions, representative card effects, reverse turns and finish detection.

## Environment

Copy `.env.example` values into the deployment environment. Do not commit production secrets.

- `PORT` — listening port supplied by the host.
- `ALLOWED_ORIGINS` — comma-separated browser origins.
- `ROOM_DATA_FILE` — optional JSON snapshot path for staging smoke tests.

Without `ROOM_DATA_FILE`, rooms are memory-only and disappear after a restart. The JSON adapter is suitable for limited staging tests, not a multi-instance public deployment. Production must use a durable database adapter before domain cutover.

## REST API

Base path: `/api/v1`

### Create room

`POST /rooms`

```json
{
  "playerName": "Host",
  "token": "tokenA",
  "color": "#22c55e",
  "maxPlayers": 10
}
```

The response includes `playerId` and a private `reconnectToken`. Store those values only in the creating player's browser.

### Join room

`POST /rooms/:code/join`

```json
{
  "playerName": "Guest",
  "token": "tokenB"
}
```

### Read room

`GET /rooms/:code`

Headers:

```text
X-Player-Id: <player id>
X-Session-Token: <reconnect token>
```

### Set ready

`POST /rooms/:code/ready`

```json
{
  "ready": true,
  "expectedVersion": 2
}
```

Authentication headers are required.

### Start game

`POST /rooms/:code/start`

```json
{
  "expectedVersion": 4
}
```

Only the host can start, at least two players must be present, and every player must be ready.

### Roll dice

`POST /rooms/:code/actions`

```json
{
  "type": "ROLL_DICE",
  "actionId": "c6dc4ce9-0d89-4ac8-b722-cf34d63f68b9",
  "expectedVersion": 5
}
```

The server creates the dice result, movement, HIT-card draw/effect, next turn and winner. Repeating the same `actionId` is idempotent.

### Reconnect

`POST /rooms/:code/reconnect`

```json
{
  "playerId": "<player id>",
  "reconnectToken": "<private token>"
}
```

### Leave

`POST /rooms/:code/leave`

```json
{
  "expectedVersion": 8
}
```

Authentication headers are required.

## Production boundary

The current High Land rules, including the approved 109-space board and 39-card HIT deck, now run in the authoritative service. Public production is still blocked on three things: a durable database adapter, a clean repository-wide CI run, and a two-device staging game on Hostinger. The JSON snapshot adapter is staging-only.
