# Locked Multiplayer Backend Decision

Decision date: 2026-07-13

## Selected system

DTF browser games use the existing Hostinger PHP Website Room API as the active
multiplayer backend. High Land is the first implementation.

```txt
Source: apps/high-land-web/public/api/
Live:   https://dtfseeds.com/games/high-land/api/
Client: apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
```

The API is deployed beside the static game build. It stores turn-based room
state on the paid-for Hostinger account and the client polls for snapshots every
two seconds. This is the approved no-new-monthly-cost architecture.

## Verified live boundary

- The API index is served by PHP and rejects nonspecific requests.
- `create-room.php` exists and requires POST.
- `get-room.php` exists and requires a valid room code.
- The production client selects website transport on
  `dtfseeds.com/games/high-land/`.

These checks prove the API boundary exists. They do not by themselves prove a
complete two-device game. Full multiplayer acceptance still requires creating a
room, joining from a separate browser/device, synchronizing turns/HIT cards,
refreshing/reconnecting, and completing a game.

## Superseded systems

Supabase is not the selected backend. Existing `/supabase` files and older
Supabase documents are historical planning artifacts only. `.mcp.json` has been
removed so coding agents do not reconnect it accidentally.

The Colyseus server under `apps/high-land-server` is an experimental scaffold,
not production room authority. Cloudflare may be used for DNS, proxying, or
future edge services, but it is not the current game-state database unless this
decision is explicitly replaced.

## Change control

Do not introduce another multiplayer authority without:

1. a written replacement decision;
2. a migration and rollback plan;
3. cost and free-tier review;
4. authentication and abuse controls;
5. two-browser/device tests; and
6. removal of the prior authority after cutover.
