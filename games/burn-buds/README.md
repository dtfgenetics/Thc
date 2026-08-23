# Burn Buds

Burn Buds is a standalone two-player browser fleet battle game with a cannabis-leaf theme.

## Included in v0.1

- 15×15 game boards
- Create/join rooms with six-character room codes
- Five-piece cannabis-leaf fleet (sizes 5, 4, 3, 3, 2)
- Manual placement, rotation, and random placement
- Server-authoritative turns, hit/miss detection, sinking, and win state
- Full-screen **BUD BURNED!** sink animation
- Per-room real-time text chat and system event messages
- Active-game recovery from the lobby
- SSE real-time state updates (no Socket.IO dependency)
- JSON file persistence for simple deployments
- Responsive desktop/mobile UI
- No external runtime npm dependencies

## Run

```bash
npm start
```

Then open http://localhost:3000 in two browser profiles/windows, create a room in one and join it from the other.

## Production note

`data/games.json` is intentionally simple for the first build. For multi-instance or serverless hosting, replace the JSON store with Postgres/Redis or another shared database. The client/API boundary is already separated so that upgrade does not require rewriting the UI.
