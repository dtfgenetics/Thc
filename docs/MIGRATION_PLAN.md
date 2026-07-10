# Migration Plan

## Principle

Do not replace the live WordPress games or move `dtf420.com` until a complete staging game has passed multiplayer tests. The migration is additive first and destructive only after rollback is proven.

## Phase 0 — Preserve and inventory

- Keep the current `dtfseeds.com` pages unchanged.
- Keep a tagged release or downloadable build of every working game.
- Record current game URLs, rules, assets and known defects.
- Treat `dtfgenetics/Thc` as the High Land source of truth.
- Inventory the separate game repositories before combining them.

Exit condition: every current game can be restored without relying on the live builder.

## Phase 1 — Authoritative multiplayer foundation

- Add secure player session and reconnect tokens.
- Add room state versions and action idempotency.
- Add REST endpoints for create, join, read, ready, start, roll, reconnect and leave.
- Generate dice and movement on the server.
- Add a storage interface with memory storage for tests and a durable production adapter.
- Add server unit and integration tests to CI.

Exit condition: automated tests prove that illegal turns, duplicate actions and invalid reconnects are rejected.

## Phase 2 — High Land client integration

- Add an authoritative API transport to the current `RoomTransport` abstraction.
- Store room, player and reconnect information in local storage.
- Keep local mode for development and pass-and-play.
- Replace browser-generated online dice and state replacement with server action requests.
- Poll room state and reconcile client animation from authoritative snapshots.
- Display connection, reconnect and stale-action errors clearly.

Exit condition: two separate browser contexts can create, join, start, roll, refresh and reconnect.

## Phase 3 — Complete High Land rules

- Move HIT-card deck creation and card effects into the authoritative rules package.
- Preserve deterministic tests by injecting a random source.
- Verify skip turns, reverse direction, movement cards, swaps, protection and winner detection.
- Add full-game Playwright coverage.

Exit condition: a complete online game can finish without any browser deciding authoritative state.

## Phase 4 — Staging deployment

- Use Hostinger `Deploy Web App` from the GitHub branch or a release branch.
- Deploy the API and web client to temporary/staging URLs.
- Add environment variables in Hostinger, not in GitHub.
- Configure allowed origins.
- Verify HTTPS, mobile behavior, logs and restart recovery.
- Run a real two-device game over different networks.

Exit condition: staging survives refreshes, reconnects and an application restart without losing durable rooms.

## Phase 5 — Build the hub shell

- Add the `dtf420.com` home page, game catalog and game detail routes.
- Add shared create/join lobby surfaces.
- Add guest-first identity and optional account upgrade.
- Link WordPress content and store pages back to `dtfseeds.com`.
- Add monitoring, privacy information and player support surfaces.

Exit condition: High Land launches through the hub and the old WordPress game remains available as rollback.

## Phase 6 — Domain cutover

- Back up the current Website Builder site.
- Connect `dtf420.com` only after staging approval.
- Verify DNS, SSL, canonical URLs and redirects.
- Monitor errors and room creation during the first release window.
- Keep a documented rollback to the previous DNS/deployment target.

## Phase 7 — Migrate additional games

Migrate one title at a time through the shared game-module contract. Do not copy room/auth/reconnect logic into each game.

Suggested order:

1. High Land
2. THC Chess or another deterministic turn-based title
3. Weedopolis
4. THC U Know
5. Guess Who
6. larger RPG or simulation titles

Each migration must add game-specific rules and tests while reusing the same player, room, session and deployment systems.

## Manual account-level steps

The following remain owner-controlled:

- creating or selecting the production database
- entering server secrets and database credentials in Hostinger
- clicking `Deploy Web App`
- connecting staging and production domains
- approving DNS changes
- deciding when to retire the old Website Builder or WordPress game route
