# Current System Audit

## Scope

This audit covers the source currently in `dtfgenetics/Thc`, with High Land as the first multiplayer pilot.

## What already exists

### Browser game

- `apps/high-land-web` is a Vite, React, TypeScript and Phaser application.
- The game already has player setup, board coordinates, turn rules, movement, HIT cards, audio, room UI and browser tests.
- Its current production target is `https://dtfseeds.com/games/high-land/`.
- The web package builds to `apps/high-land-web/dist`.

### Local multiplayer simulation

- The web app contains a local room transport and local room actions.
- The same browser process can create a room, join players and exercise the game flow for development.
- This is useful for tests, but it is not online multiplayer.

### Shared-hosting PHP room API

- `apps/high-land-web/public/api` contains a dependency-free PHP room API.
- It stores each room as a JSON file under `api/_rooms`.
- The browser polls the API for state updates.
- It can create rooms, join rooms, read rooms, append events and replace game state.

### Node/Colyseus server scaffold

- `apps/high-land-server` contains an Express and Colyseus server.
- It supports room joining, server-generated dice, movement, turns, disconnect flags and winner state.
- It is not currently connected to the production browser client.
- Its game rules are incomplete compared with the web game.

## Critical findings

### 1. There are two competing multiplayer backends

The PHP room API and the Colyseus server represent two different directions. The browser currently defaults to the PHP transport on `dtfseeds.com`, while the Node server is a separate scaffold. Maintaining both as authoritative systems would create rule drift and difficult bugs.

### 2. The deployed PHP flow is not server-authoritative

The current browser calculates the dice result, movement, card resolution, turn changes and winner, then sends a replacement `GameState` to PHP. PHP checks basic room membership and whose turn it appears to be, but the submitted state itself is trusted. A modified browser could submit an invented roll, position or winner.

### 3. Player IDs are not authentication

Knowing or choosing a player ID is enough to submit updates. There is no secret session token tied to a player, no token hashing, and no secure reconnect credential.

### 4. There is no state version or action idempotency

Two requests can be based on the same old state. A double click, retry or delayed request can repeat an action or overwrite a newer state. Room files are locked while being written, but the application does not reject stale actions.

### 5. The Node server is not production complete

The Colyseus server uses memory-only room state and has no persistent repository, no secure reconnect token, no REST polling fallback, no rate limiting and no integration tests. It also implements only a small subset of the current game rules.

### 6. CI validates the web app but not the server

The existing High Land CI runs web unit tests, build, browser tests and PHP syntax checks. It does not build or test `apps/high-land-server`, so server regressions can merge unnoticed.

### 7. The repository is a High Land workspace, not yet a game hub

The root workspace has one main web application and a separate server. The other games are in separate repositories. A shared hub, account layer, room service and game-module contract have not yet been established.

## Immediate decision

Do not rewrite all games at once and do not move the live domain yet.

The safest execution sequence is:

1. Make one authoritative multiplayer service pass automated tests.
2. Connect High Land to it using REST polling first.
3. Deploy to a staging URL.
4. Complete two-browser and reconnect tests.
5. Build the `dtf420.com` hub shell around the proven service.
6. Migrate additional games one at a time.

## First milestone acceptance criteria

- A host creates a private room and receives a six-character code.
- A second browser joins with a player name.
- Both clients read the same room state.
- Each player has a private reconnect token that is never returned in room state.
- Only the host can start.
- Only the active player can roll.
- Dice and movement are generated on the server.
- Duplicate action IDs do not repeat actions.
- Stale state versions are rejected.
- Refreshing reconnects the same player.
- Server build and tests run in GitHub Actions.
- No production domain is changed until staging passes.
