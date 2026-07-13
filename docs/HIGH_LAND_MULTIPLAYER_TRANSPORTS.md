# High Land Multiplayer Transports

The room transport boundary supports offline/local development and the selected
Hostinger Website Room API without changing game rules.

## Current files

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/websiteRoomApi.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.ts
```

## Transport roles

### Local transport

Used for offline development, automated tests, pass-and-play, and recovery when
the online room service is unavailable.

### Website transport

Selected automatically on `dtfseeds.com/games/high-land/`. It calls the PHP API
under the same route and polls room snapshots every two seconds.

Required behavior:

- create a room and identify its host;
- join by room code;
- update authoritative game state;
- append auditable game events;
- poll snapshots and report connection errors;
- preserve invite codes across refresh/reconnect.

## Production rule

The locked backend is defined in `docs/BACKEND_DECISION.md`. Do not reconnect
Supabase or introduce a parallel room authority. A replacement requires an
explicit decision, migration, cost review, security review, and rollback plan.

## Completion evidence

Repository tests and API guard responses are necessary but insufficient. Online
multiplayer is production-ready only after a host and a separate browser/device
complete room creation, join, start, dice movement, HIT-card resolution, turn
order, refresh/reconnect, and winner synchronization.
