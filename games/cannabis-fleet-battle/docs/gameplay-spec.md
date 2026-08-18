# Cannabis Fleet Battle gameplay contract

## Lobby

A player creates a room and receives a shareable code/link. A second player joins with a display name. The server owns the room state and rejects a third active player.

## Placement

Each player receives a private 15 × 15 grid. Fleet objects occupy contiguous horizontal or vertical cells. Placement validation must reject overlap, out-of-bounds coordinates, duplicate object IDs, and malformed rotations. Fleet coordinates are never sent to the opponent before resolution requires them.

## Battle

The server chooses/records the starting player, accepts one legal untargeted coordinate from that player, resolves the result, records hit/miss/sunk state, then advances the turn unless the final fleet object has been sunk. Exact repeat-shot behavior must be explicit and tested; default implementation should reject duplicate attacks rather than silently consume a turn.

## Reconnect

Rooms need a stable reconnect token or authenticated session strategy so a browser refresh does not automatically forfeit a match. Reconnect data must never expose hidden opponent placement.

## Security/integrity

The browser is a view/controller, not the authority. Do not trust client-supplied hit results, turn ownership, sunk status, or victory. Rate-limit room creation and attack events and validate all payload shapes.

## Implementation sequence

1. Define fleet JSON schema and exact composition.
2. Build pure placement/attack engine with deterministic tests.
3. Add multiplayer room server.
4. Add invite/reconnect flow.
5. Build responsive board UI.
6. Run two-browser end-to-end tests before public deployment.
