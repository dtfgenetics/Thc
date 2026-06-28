# High Land locked specification

This document is the product contract for High Land work. It defines the target;
it does not claim that every current branch already meets it. Gameplay gaps must
be repaired in a gameplay-specific change, not hidden inside a controls-only PR.

## Identity and scope

- Title: **High Land: The Sweet Escape**.
- Audience: adults 21+; entertainment only.
- Format: an original fantasy cannabis board game with a readable,
  Candy Land-style colored route.
- App: `apps/high-land-web` in `dtfgenetics/Thc`.
- Public route: `/games/high-land/`.
- Live URL: `https://dtfseeds.com/games/high-land/`.
- Do not add Weedopolis, High IQ, Monopoly, strain prices, property cards, or
  content from any unrelated game.

## Locked world order

The continuous route visits these locations in this order:

1. Rolling Hills
2. Dankwood Forest
3. Rosin Rail Station
4. Munchie Mountain
5. Kief Caves
6. Trichome Towers
7. Cloud 9 Citadel

## Board and path contract

- `apps/high-land-web/src/game/data/boardPath.ts` is the source of truth for
  ordered spaces and token coordinates.
- The target board contains exactly 111 continuous indexes, `0` through `110`.
- Index `0` is START and index `110` is FINISH at Cloud 9 Citadel.
- There is one route, no branches, and every index connects to the next.
- Allowed space types are only `start`, `normal`, `action`, and `finish`.
- `actionSpaceIndexes` is the source of truth for exactly 25 gameplay HIT spaces.
- Every gameplay HIT space must be visibly identifiable on the rendered board.
- Use authored High Land board/card assets when they exist. A fallback must remain
  a polished fantasy cannabis board, never a flat placeholder.

## Dice, movement, and tokens

- A die returns an integer from 1 through 6.
- A normal roll moves the active token exactly the rolled number of indexes.
- Movement clamps at START and FINISH.
- Animate normal movement through every traversed index.
- Card jumps may use their coded effect but must still resolve to a valid index.
- Render every token directly on its `boardPath` coordinate.
- Slightly offset colocated tokens while keeping all of them inside the space.
- Reaching FINISH declares the winner and stops further movement.

## HIT spaces and cards

- Landing on any of the 25 HIT indexes draws a HIT card; old four-space-only
  behavior is invalid.
- Apply card effects immediately and synchronize the resulting state.
- Card text must exactly describe the coded effect.
- Safe supported effect families include forward/backward movement, skip turn,
  draw again, roll again, next/previous color, position swaps, leader movement,
  group movement, backward-movement protection, and choosing another player.
- Bound card movement to START/FINISH and cap chained draws to prevent loops.
- Board spaces do not have hidden trap, boost, or safe mechanics. Such behavior
  exists only through explicit card effects.

## Players and names

- Local play supports 1-10 players.
- Online invite play supports 2-10 players.
- Accept a display name for each player and show it in setup, turns, standings,
  cards that target players, and winner UI.
- Normalize blank names to stable numbered fallbacks such as `Player 1`.

## Invite multiplayer

- The host creates a room and shares `?game=ROOMCODE`.
- Guests opening that URL join the same lobby with their display name.
- The lobby shows joined players; only the host starts with at least two players.
- Only the active player may commit a roll or state-changing turn action.
- Synchronize dice, traversal, token positions, HIT card/effect chains, skips,
  choices, turn order, reconnect state, and winner.
- Reject stale or unauthorized commits server-side.
- Restore a player's session after refresh when possible.
- Never expose session tokens, secrets, private credentials, or private room data
  in public room snapshots.

## Presentation

- The board is the visual focus and remains readable on desktop and mobile.
- Controls do not cover the board.
- Show the active player, rolled value, names, and latest HIT reveal clearly.
- Use a card panel or modal, not a browser alert.
- Include a clear winner state, a 21+ entertainment-only note, and user-controlled
  mute/unmute when audio exists. Do not autoplay loud audio.

## Verification and deployment boundary

Repository validation requires unit tests, a production build, and browser smoke
tests. Those results prove only the tested checkout. They do not prove that
Hostinger serves that build. Live acceptance additionally requires the HTTP,
asset, API, mobile, reconnect, and two-browser invite checks in
`docs/deployment-hostinger.md`.
