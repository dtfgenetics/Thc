# THC Games Workspace - Agent Instructions

This repository is the working codebase for the DTF / THC browser games and website game hub.

## Project priorities

1. Keep the live game code stable.
2. Do not overwrite existing game logic without inspecting the current implementation and tests first.
3. Treat `main` as the production branch.
4. Use the Hostinger PHP Website Room API for shared multiplayer rooms.
5. Keep High Land web app code under `/apps/high-land-web`.
6. Never commit secrets, service role keys, database passwords, bot tokens, or `.env` files.

## Current repository structure

```txt
/
  apps/
    high-land-web/
      package.json
      src/
  docs/
  supabase/                 # legacy planning only; not the active backend
  package.json
  .gitignore
```

## High Land game notes

Current gameplay goals:

- 2-4 players
- player naming
- invite/session links for multiplayer
- dice rolls that match spaces moved
- tokens that sit on the board spaces, not beside the board
- text and icons contained inside board boxes without overlap
- action card logic for forward/back movement
- tests for core movement and board integrity

Before changing High Land:

```bash
npm install
npm run test:high-land
npm run build:high-land
```

If tests fail, inspect the failure before changing unrelated code.

## Multiplayer backend notes

The approved backend is the existing Hostinger PHP Website Room API:

```txt
apps/high-land-web/public/api/
https://dtfseeds.com/games/high-land/api/
```

The browser selects `websiteRoomTransport` on the live High Land route and polls
room snapshots every two seconds. Local transport remains available for offline
development and tests. Do not add Supabase, Firebase, or a second room authority
without an explicit replacement decision and migration plan.

Room JSON storage must remain outside public browsing, room codes must be
validated, writes must be host/player authorized, and no credentials may enter
browser code.

## Deployment notes

The site deployment should build the High Land app from:

```bash
npm run build:high-land
```

The production build output is expected at:

```txt
apps/high-land-web/dist
```

## Working rules for Codex, Claude Code, and other agents

- Read `README.md`, this file, and relevant docs before making changes.
- Prefer small pull requests with clear titles.
- Run available tests and builds before claiming success.
- Add or update tests when changing game rules, movement, multiplayer, room API authorization, or storage.
- Do not rename projects, games, domains, routes, or brand terms unless explicitly requested.
- Do not replace the existing High Land game with a generic demo.
- Preserve the existing DTF / THC branding and game direction.

## Connection map

- GitHub repo: `dtfgenetics/Thc`
- Production branch: `main`
- Multiplayer backend: Hostinger PHP Website Room API
- API source: `/apps/high-land-web/public/api`
- Live API: `https://dtfseeds.com/games/high-land/api/`
- Website/game app: `/apps/high-land-web`
- Target domains: `dtfseeds.com`, `dtf420.com`
