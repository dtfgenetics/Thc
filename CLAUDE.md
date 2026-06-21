# THC Games Workspace - Agent Instructions

This repository is the working codebase for the DTF / THC browser games and website game hub.

## Project priorities

1. Keep the live game code stable.
2. Do not overwrite existing game logic without inspecting the current implementation and tests first.
3. Treat `main` as the production branch.
4. Keep Supabase configuration under `/supabase` at the repository root.
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
  supabase/
    config.toml
    seed.sql
    migrations/
    functions/
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

## Supabase notes

Supabase GitHub integration should use:

```txt
Working directory: .
Production branch name: main
```

Supabase files live in `/supabase`.

Use migrations for schema changes. Do not make undocumented production database changes. New tables exposed to the public API must have Row Level Security enabled and reviewed.

Expected future Supabase tables:

- game_sessions
- game_players
- game_invites
- high_land_turns
- high_land_events

Do not expose service role keys in frontend code. Browser code may only use publishable or anon keys.

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
- Add or update tests when changing game rules, movement, multiplayer, auth, or Supabase schemas.
- Do not rename projects, games, domains, routes, or brand terms unless explicitly requested.
- Do not replace the existing High Land game with a generic demo.
- Preserve the existing DTF / THC branding and game direction.

## Connection map

- GitHub repo: `dtfgenetics/Thc`
- Production branch: `main`
- Supabase working directory: `.`
- Supabase folder: `/supabase`
- Website/game app: `/apps/high-land-web`
- Target domains: `dtfseeds.com`, `dtf420.com`
