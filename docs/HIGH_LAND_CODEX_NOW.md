# High Land Codex Execution Plan — Do This Now

This is the current execution file for Codex working in `dtfgenetics/Thc`.

Use this file after reading:

1. `README.md`
2. `CLAUDE.md`
3. `docs/SYSTEMS_READINESS.md`
4. `docs/TOOL_CONNECTIONS.md`
5. `docs/CODEX_HIGH_LAND_GAME_BUILD.md`

This document overrides any older direction that says to stop at a local-only prototype. The current target is a browser-playable High Land build with player naming and invite-link multiplayer, while still protecting the local game rules and tests.

---

## Product Target

Build **High Land: The Sweet Escape** as the playable game at:

```txt
https://dtfseeds.com/games/high-land/
```

Repo source of truth:

```txt
dtfgenetics/Thc
```

App path:

```txt
apps/high-land-web
```

Production branch:

```txt
main
```

Do not replace the project with a generic demo. Do not mix this game with High IQ, Weedopolis, Strain Showdown, Bud or Bluff, or THC U Know.

---

## Current Required Outcome

Codex must make the High Land web app work as a real playable browser game with:

- Player naming before the game starts.
- Invite link / room code flow so other players can join the same game session.
- Dice rolls that move the active player exactly the number of board spaces rolled.
- Tokens that sit directly on board path coordinates, not off to the side.
- A single continuous board path from start to finish.
- HIT card spaces and HIT card effects.
- Skip-turn support.
- Winner detection when a player reaches or crosses the finish.
- Winner popup / animation.
- Background audio loop with mute/unmute.
- Mobile-friendly layout.
- Tests for movement, turn order, HIT cards, room state, and path integrity.

---

## Hard Gameplay Rules

### Start

- Players start before the first playable colored space at the train/station start area.
- Use a real start coordinate in `boardPath`, not a UI sidebar.
- Every player token must render on top of the board image/path layer.

### Dice Movement

- A roll of `1` moves exactly one path index.
- A roll of `2` moves exactly two path indexes.
- A roll of `6` moves exactly six path indexes.
- Movement must animate step-by-step along `boardPath` indexes.
- Do not teleport tokens unless the card effect explicitly says to jump.

### Finish

- The player wins by reaching or crossing the final path index.
- Do not require an exact roll unless a later rules file explicitly changes this.
- Clamp final movement to the finish index.

### HIT Cards

HIT cards are part of High Land.

Minimum card effects to support:

- Move forward.
- Move backward.
- Skip next turn.
- Roll again / draw again only when safely chained.
- Jump to a named checkpoint only if the target coordinate exists.

Card effects must use shared rule functions, not UI-only hacks.

### Multiplayer

Invite-link multiplayer is required.

Minimum multiplayer behavior:

- Host can create a room.
- Room gets a short room code and shareable invite URL.
- Joining player enters a player name.
- Joined players see the same room state.
- Host can start the game.
- Only the active player can roll.
- Dice result, deck order, turn order, and positions are shared game state.
- Refresh should not immediately destroy the room.

Use the locked Hostinger PHP Website Room API in `docs/BACKEND_DECISION.md`.
Production uses the same-origin API and requires no browser credential.

Never commit service-role keys, database passwords, Hostinger private keys, Discord tokens, OpenAI keys, or GitHub tokens.

---

## Required Data Files

Codex should create or verify these files under `apps/high-land-web/src` or the closest existing structure:

```txt
game/data/boardPath.ts
game/data/hitCards.ts
game/data/locations.ts
game/rules/dice.ts
game/rules/movement.ts
game/rules/turns.ts
game/rules/hitCards.ts
game/rules/winCondition.ts
game/multiplayer/rooms.ts
game/multiplayer/websiteRoomApi.ts
game/multiplayer/websiteRoomTransport.ts
```

Exact paths may differ if the app already has a clean structure, but the responsibilities must be separated.

---

## Board Coordinate Requirement

The biggest current risk is token placement.

Codex must not fake this by positioning tokens in a sidebar or by estimating random CSS values.

Create a coordinate map like this:

```ts
export type BoardPathSpace = {
  index: number;
  x: number;
  y: number;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'special';
  type: 'start' | 'normal' | 'hit' | 'skip' | 'finish';
  location?:
    | 'Rolling Hills'
    | 'Dankwood Forest'
    | 'Rosin Rail Station'
    | 'Munchie Mountain'
    | 'Kief Caves'
    | 'Trichome Towers'
    | 'Cloud 9 Citadel';
};
```

Rules:

- Indexes must be continuous: `0, 1, 2, 3...finish`.
- Every playable space needs `x` and `y`.
- Coordinates should be normalized or clearly tied to the board render size.
- Token rendering must convert board coordinates to screen position correctly on desktop and mobile.
- Tests must fail if any path index is missing or any coordinate is invalid.

---

## Asset Rules

Expected folder:

```txt
public/assets/high-land/
  board/
  cards/
  tokens/
  audio/
  ui/
```

Required assets or placeholders:

- Board image.
- Path overlay if separate.
- Player tokens.
- Dice faces or dice animation.
- HIT card back.
- HIT card front/modal style.
- Background audio loop.
- Dice roll sound.
- Card draw sound.
- Move tick sound.
- Win sound.

Placeholders are allowed only when clearly named with `placeholder-`.

Never fake transparency with checkerboard art.

---

## Tests Codex Must Add or Keep Passing

At minimum:

```txt
npm run test:high-land
npm run build:high-land
```

Required test coverage:

- Dice returns 1-6.
- Roll value equals spaces moved.
- Movement clamps at start and finish.
- Backward movement cannot go below start.
- HIT forward card works.
- HIT backward card works.
- Skip turn decreases and advances correctly.
- Roll-again/draw-again cannot create an infinite loop.
- Winner is detected at or beyond finish.
- Board path indexes are continuous.
- Every board path space has a valid coordinate.
- Room code creation returns a usable room id/code.
- Joining a room requires a player name.
- Only the current player can roll.

Browser/manual checks:

- Game loads at local dev URL.
- Player setup screen appears.
- Host can create room.
- Second browser can join with invite code/link.
- Dice button works only on current turn.
- Token visibly moves on the board.
- HIT modal appears when landing on HIT spaces.
- Mute/unmute works.
- Mobile viewport does not push tokens off-board.

---

## Deployment Target

The Vite app must build for the final public path:

```txt
/games/high-land/
```

Codex must verify `vite.config.*` uses the correct base path for production if required:

```ts
base: '/games/high-land/'
```

Do not mark deployment complete until the production build assets load correctly from that subpath.

Hostinger / WordPress still needs verification:

- Hostinger should deploy from `dtfgenetics/Thc`.
- Branch should be `main`.
- Build command should be `npm run build:high-land` from repo root, or equivalent.
- Output directory should be `apps/high-land-web/dist`.
- WordPress or Hostinger route should point to `/games/high-land/`.

---

## Codex Task Prompt

Paste this into Codex:

```txt
Work in repo `dtfgenetics/Thc` on branch `main` or the current High Land PR branch if PR #2 is open.

Read these files first:
- README.md
- CLAUDE.md
- docs/SYSTEMS_READINESS.md
- docs/TOOL_CONNECTIONS.md
- docs/CODEX_HIGH_LAND_GAME_BUILD.md
- docs/HIGH_LAND_CODEX_NOW.md

Goal: finish High Land: The Sweet Escape as a browser-playable game for `dtfseeds.com/games/high-land/`.

Do not replace the game with a generic demo. Do not mix in High IQ, Weedopolis, Strain Showdown, Bud or Bluff, or THC U Know.

Implement or verify:
1. Player naming before start.
2. Host room creation with invite code/shareable link.
3. Join room with player name.
4. Shared room state using the Hostinger PHP Website Room API.
5. Dice roll moves exactly the rolled number of board spaces.
6. Tokens render on the board path coordinates, not in a side panel.
7. Continuous `boardPath` coordinate file with valid indexes and x/y values.
8. HIT spaces and HIT card effects: forward, backward, skip turn, roll/draw again with safe chaining.
9. Win by reaching or crossing finish; clamp to finish.
10. Background audio loop and mute/unmute.
11. Mobile-friendly board layout.
12. Tests for dice, movement, HIT cards, skip turns, board path integrity, room creation, player joining, and turn authority.
13. Production Vite base/path support for `/games/high-land/`.

Run:
- npm run test:high-land
- npm run build:high-land

Report back with:
- files changed,
- what works,
- what is still placeholder,
- what manual setup is still needed in Hostinger,
- and the exact production deployment path.

Do not commit secrets.
```

---

## Definition of Done

High Land is not done until:

- A named player can start or join.
- Two browser sessions can share one room.
- Dice movement visually matches the rolled number.
- Tokens sit on board spaces.
- HIT cards affect movement/turns correctly.
- The winner popup appears.
- Audio works and can be muted.
- Tests and production build pass.
- The app is ready to deploy to `dtfseeds.com/games/high-land/`.
