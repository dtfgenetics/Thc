# High Land Multiplayer Transports

This file records the current multiplayer transport implementation. It does not require High Land to keep any particular backend, transport, polling model, API location, or repository structure.

## Current implementation

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/websiteRoomApi.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.ts
```

The current live implementation uses a same-origin Hostinger PHP room API. This may be retained, replaced, migrated, or removed when another approach better serves the game.

## Behavior to verify when multiplayer exists

- room/session creation and joining work;
- authorized players can perform intended actions;
- game state synchronizes correctly;
- reconnect/resume behaves as designed;
- connection failures are visible and recoverable;
- secrets, private credentials, and hidden room state are not exposed publicly.

The specific backend, state model, protocol, polling/websocket approach, and hosting provider are implementation choices rather than fixed product rules.

## Completion evidence

Repository checks alone do not prove live multiplayer. When multiplayer is part of the current build, verify it with at least two independent sessions and separately verify the exact deployed production route.
