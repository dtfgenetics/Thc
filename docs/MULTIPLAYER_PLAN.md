# Multiplayer Plan

Multiplayer is scaffolded but should not be the first thing Codex finishes.

## Current scaffold

Server app path:

```txt
apps/high-land-server
```

Files:

```txt
apps/high-land-server/package.json
apps/high-land-server/tsconfig.json
apps/high-land-server/src/index.ts
apps/high-land-server/src/schema/GameState.ts
apps/high-land-server/src/rooms/GameRoom.ts
```

## Current server features

- Colyseus room scaffold.
- 2-4 player join support.
- lobby phase.
- ready/start message.
- server-side dice roll.
- server-side position update.
- turn advancement.
- disconnected player flag.
- simple game log.
- winner state.
- health endpoint.

## Server commands

```bash
cd apps/high-land-server
npm install
npm run dev
```

Health check:

```txt
http://localhost:2567/health
```

## Important rule

Do not wire this into the client until the local pass-and-play game is fully working.

## What Codex must add later

1. Move shared rules into a package so web and server use the same movement/card logic.
2. Add action-card effects to the server room.
3. Add server-side shuffled deck with seed.
4. Add room code display in the client.
5. Add join room form.
6. Add reconnect support.
7. Prevent clients from rolling out of turn.
8. Prevent clients from sending direct position edits.
9. Add Playwright two-browser multiplayer test.
10. Deploy server to a Node/WebSocket host.

## Why this is separate from WordPress

WordPress can host/link the static browser app, but it should not run live multiplayer game state. The multiplayer server needs a persistent Node.js process with WebSocket support.
