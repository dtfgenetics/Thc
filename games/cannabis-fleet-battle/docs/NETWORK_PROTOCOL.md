# Cannabis Fleet Battle — Server Authority Contract

The multiplayer server owns the complete match state. Clients send intents and receive player-scoped public views; they never submit authoritative hit/miss results, ship damage, turn changes, or winner state.

## Match lifecycle

`lobby → placement → battle → complete`

A room begins with one host. Joining a second unique player moves the match to placement. Each player sends one complete fleet placement payload. The server validates the entire fleet and locks it atomically. Battle begins only after both fleets are valid and locked.

## Canonical fleet

The 15×15 prototype board uses six pieces and 21 occupied cells total:

- Glass Rig — 5
- Water Pipe — 4
- Rolling Tray — 4
- Grinder — 3
- Vape Pen — 3
- Dugout — 2

Fleet names are presentation labels. Server validation is based on the canonical IDs and lengths in `data/fleet.json`.

## Client intents

### Join room

```json
{ "type": "join-room", "playerId": "opaque-session-player-id", "playerName": "Player" }
```

### Lock fleet

```json
{
  "type": "lock-fleet",
  "placements": [
    { "shipId": "glass-rig", "row": 0, "col": 0, "orientation": "H" }
  ]
}
```

The real payload must include exactly one placement for every canonical ship. The server rejects missing ships, duplicate IDs, invalid orientations, overlap, and any cell outside rows/columns `0..14`.

### Attack

```json
{ "type": "attack", "row": 7, "col": 9 }
```

The server derives the player identity from the authenticated socket/session, verifies turn ownership and target validity, records the shot, checks the opponent's private fleet, updates damage/sunk state, and decides the next turn or winner.

Clients must never be allowed to send fields such as `hit`, `sunk`, `winner`, `nextTurn`, or opponent ship coordinates as authoritative values.

## Public state

`publicView(match, viewerPlayerId)` is the serialization boundary. During lobby/placement/battle:

- the viewer receives their own full ship coordinates;
- the viewer receives opponent ship IDs/names/lengths, hit coordinates already earned through attacks, and sunk flags;
- the viewer does **not** receive unhit opponent ship cells, starting coordinates, or orientations;
- both players may see public shot history and connection state;
- after `complete`, both fleets may be revealed.

The production transport should serialize this public view rather than sending the internal match object to either browser.

## Reconnect behavior

Disconnecting a socket does not change turn ownership or mutate the board. A reconnect should authenticate back to the same server-side player identity and request a fresh `publicView`. Room membership must not rely solely on a user-supplied player ID or room code.

## Production security requirements

- Generate match/session identifiers server-side with cryptographically secure randomness.
- Bind a player to an authenticated or unguessable reconnect token stored server-side or in a signed/encrypted session.
- Rate-limit room creation/join and attack intents.
- Reject oversized payloads and unexpected fields before game-engine calls.
- Never log secret reconnect tokens or complete private match snapshots to public/client logs.
- Persist or snapshot active matches if the chosen host can restart unexpectedly.
- Add expiry/cleanup for abandoned rooms.
- Treat spectator support as a separate public-view role; do not reuse either player's private view.

## Required end-to-end checks before production multiplayer

1. Two browsers create/join by invite code.
2. Each browser sees only its own locked fleet.
3. Invalid and overlapping placements are rejected without partial mutation.
4. Simultaneous attack requests cannot both advance the same turn.
5. Repeated attacks are rejected.
6. Hit, sink, turn, and win results match the server engine.
7. A disconnected player can reconnect to the same private view without changing the turn.
8. A guessed room code alone cannot impersonate either player.
9. Mobile placement and targeting are usable on a 15×15 board.
10. Refresh/reconnect during every phase preserves or intentionally expires state according to the hosting policy.
