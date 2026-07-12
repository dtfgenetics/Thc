# Target Architecture

## Domains

### `dtfseeds.com`

Keep WordPress as the store, publishing, product and search-discovery site. Existing games remain available during migration.

### Staging game hub

Deploy the new application to a Hostinger temporary domain or a staging subdomain before changing `dtf420.com`.

### `dtf420.com`

After staging acceptance, use this domain as the dedicated game hub.

## Source of truth

GitHub is the source of truth. Hostinger should deploy from a reviewed branch or release commit. Website Builder and Horizons must not become parallel editable copies of the production game code.

## Application boundaries

### Game hub web application

Responsibilities:

- game catalog and navigation
- guest and registered player entry
- create/join room screens
- lobby and connection status
- profiles, achievements and history later
- loading each game module
- client animation and presentation

The browser is not authoritative for random results, turns, positions, card effects or winners.

### Multiplayer API

Responsibilities:

- room codes and invitation links
- player sessions and reconnect tokens
- lobby membership and ready state
- host permissions
- server-generated random results
- legal-action validation
- state versioning and idempotency
- authoritative game-state transitions
- action log
- expiration and cleanup

Version one uses REST requests and one-to-two-second polling. This works on managed hosting without requiring inbound WebSocket support. A realtime transport can be added behind the same client interface later.

### Persistence

The service uses a repository interface.

- Development and automated tests may use memory storage.
- Staging may use a local JSON snapshot only for smoke testing.
- Production should use a durable database such as Supabase PostgreSQL or Hostinger MySQL.
- Storage credentials stay server-side.

## Shared multiplayer model

```text
Room
- id
- code
- gameSlug
- status
- hostPlayerId
- version
- players
- gameState
- processedActionIds
- createdAt
- updatedAt
- expiresAt

Player session
- playerId
- displayName
- token/avatar
- color
- ready
- connected
- joinedAt
- lastSeen
- reconnectTokenHash

Action
- actionId
- roomCode
- playerId
- type
- expectedVersion
- payload
- createdAt
```

The raw reconnect token is returned once to the player and stored locally in that player's browser. Only its hash is stored by the server.

## Game-module contract

Each game should eventually provide pure, testable functions:

```text
createInitialState(players, random)
getPublicState(state, viewer)
validateAction(state, playerId, action)
applyAction(state, playerId, action, random)
determineWinner(state)
```

Rendering stays separate from these rules. Phaser owns board rendering and animation; React owns menus, forms, lobby UI and accessibility-sensitive controls.

## First game: High Land

The first server-authoritative actions are:

- `SET_READY`
- `START_GAME`
- `ROLL_DICE`
- `LEAVE_ROOM`
- `RECONNECT`

The server must produce a High Land state compatible with the current client model. HIT-card resolution should be moved into the shared authoritative rule layer before public multiplayer is declared complete.

## Security boundaries

- Do not trust player IDs without a matching session token.
- Do not accept a dice value, destination, turn index or winner from the browser.
- Require an idempotency/action ID for mutations.
- Require an expected state version for game actions.
- Hash reconnect tokens before storage.
- Enforce allowed origins in production.
- Rate-limit room creation, joining and actions.
- Sanitize names and cap all input lengths.
- Never expose service-role or database credentials to Vite client code.
- Keep private player information out of public room snapshots.

## Deployment topology

```text
dtfseeds.com (WordPress)
        |
        | Play links
        v
dtf420.com (game hub web app)
        |
        | HTTPS REST + polling
        v
api.dtf420.com or same-origin /api/v1 (Node service)
        |
        v
Durable database
```

For the first Hostinger deployment, the web app and API may be deployed as separate Web Apps. Same-origin routing can be added later through a reverse proxy or domain configuration.
