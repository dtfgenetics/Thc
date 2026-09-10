# High Land Multiplayer Transports

Updated: 2026-09-09

This document describes the current multiplayer transport implementation. It does not lock High Land to a particular backend, polling model, room authority, or transport architecture.

## Current files

```txt
apps/high-land-web/src/game/multiplayer/roomTransport.ts
apps/high-land-web/src/game/multiplayer/localRoomTransport.ts
apps/high-land-web/src/game/multiplayer/websiteRoomApi.ts
apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts
apps/high-land-web/src/game/multiplayer/roomTransportFactory.ts
```

## Current transports

### Local transport

The current code includes a local transport for offline development and local play.

### Website transport

The current production build includes a same-origin website transport backed by PHP room endpoints under the High Land route.

## Redesign freedom

The transport interface, backend technology, room model, polling/realtime strategy, persistence, invite flow, and synchronization model may be changed or replaced as needed. Update this document and deployment metadata when the implementation changes.

## Verification

For whatever multiplayer architecture is active, test the behavior that matters to players: room creation/join, turn synchronization, reconnect/refresh, hidden/private state where applicable, error handling, and completion across separate clients/devices.
