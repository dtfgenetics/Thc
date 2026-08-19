# High Land: The Sweet Escape — Drive Rulebook & Digital Game Specification

- Drive source ID: `1BOdOkEO3Lx7wTWniCyx38eUIMfUrROWUHYKM65sRYpI`
- Drive title: `High Land - Rulebook and Digital Game Specification`
- Drive created: 2026-06-22T02:32:20.718Z
- Drive modified: 2026-07-14T23:15:02.834Z
- Migration date: 2026-08-18
- Record role: controlled Drive specification/provenance mirror

> Implementation-status note: this document preserves the controlled Drive requirements and historical issue list. Current implementation status is determined by `apps/high-land-web`, its tests, current project registry, deployment manifest, and live verification. Historical “Known Current Issues” below must not overwrite newer verified code state.

## Purpose

High Land is a DTFSeeds browser game where players move through an original fantasy cannabis world, draw HIT cards, and race to Cloud 9 Citadel.

## Core gameplay

- Players enter a display name before joining a game.
- One player creates a room.
- Other players join through an invite link or invite code.
- Players take turns rolling dice.
- The number rolled must exactly match the number of board spaces moved.
- Player tokens must visually sit on the board path.
- HIT spaces trigger HIT cards.
- HIT cards can move a player forward or backward, skip a turn, or trigger a special effect.
- First player to reach Cloud 9 Citadel wins.

## Approved world locations

1. Rolling Hills — joint/rolling themed hill zone.
2. Dankwood Forest — huge cannabis forest with massive plants.
3. Rosin Rail Station — sticky amber/gold resin train station.
4. Munchie Mountain — food/candy mountain region.
5. Kief Caves — underground kief cave zone.
6. Trichome Towers — trichome/crystal tower region.
7. Cloud 9 Citadel — finish/castle-in-clouds zone.

## Board rules

- Single continuous path only.
- No alternate routes.
- Every colored square must touch the next square.
- Path should have thick white edging.
- Digital movement must be coordinate-driven.
- Every playable space needs an index and x/y coordinate.
- Tokens must snap to the center of board spaces.

## Digital requirements from the Drive specification

- Persistent room creation.
- Player display names, turn order, and token positions.
- Invite codes/links.
- Saved board/game state.
- Realtime updates so all players see movement.
- Reconnect support after refresh/disconnect.
- Mobile-responsive layout.
- Background audio toggle.
- Animated dice roll.
- Animated token movement.
- HIT-card reveal animation.

The Drive source originally named Supabase tables (`game_rooms`, `game_players`, `game_invites`, `game_state_snapshots`) as the intended persistence layer. Current runtime architecture may satisfy these contracts through a different implementation if the same behaviors and authority guarantees are preserved.

## Historical issues recorded by the Drive source

These were recorded before the current GitHub implementation and are retained only as migration provenance:

- Live game may not have been the intended build.
- Dice rolls were not properly reflected by spaces moved.
- Tokens needed to sit directly on board spaces.
- Unrelated board-concept prices/text/images could overlap spaces.
- Visual polish/background audio were incomplete.
- Multiplayer invite flow was incomplete.

## Canonical Drive asset folders

- `01 Rules` — rulebook, spec, gameplay requirements.
- `02 Board` — master board, path layer, coordinate map, exports.
- `03 Icons` — location icons, HIT/start/finish icons.
- `04 Cards` — HIT card templates and final card art.
- `05 Audio` — background loops and SFX references.
- `06 Player Tokens` — token art and animation states.
- `07 UI` — buttons, panels, modals, game controls.
- `08 Digital` — persistence schema, frontend implementation notes, repo handoff.
- `09 Print` — printable rule sheets/physical adaptation.

## Historical next-required list from Drive

The July 2026 Drive version listed these as next actions: board coordinate map, final HIT card list, invite-room flow, starter icon/token import, persistence tables, and repo write access. Treat each item as historical until compared with current source and tests.

## Source-of-truth rule

Drive remains provenance for this human-readable rule/spec record and approved art/print assets. GitHub remains canonical for executable behavior, machine-readable data, tests, CI, and deployment configuration.
