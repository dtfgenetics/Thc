# Browser Game Project

This repo contains the browser-based board game build.

## Run locally

```bash
cd apps/high-land-web
npm install
npm run dev
```

## Build

```bash
cd apps/high-land-web
npm run build
```

The production build outputs to:

```txt
apps/high-land-web/dist
```

## Project docs

Read these first:

- `docs/HIGH_LAND_CODEX_NOW.md` — current Codex execution plan and acceptance criteria
- `docs/SYSTEMS_READINESS.md`
- `docs/TOOL_CONNECTIONS.md`
- `docs/CODEX_HIGH_LAND_GAME_BUILD.md`
- `docs/GITHUB_CODE_TO_USE.md`

## Current phase

Current target is the playable High Land browser build for:

```txt
https://dtfseeds.com/games/high-land/
```

The app must support:

- player naming
- invite-link / room-code multiplayer
- dice roll movement that exactly matches spaces moved
- tokens positioned directly on board path coordinates
- continuous board path data
- HIT/action cards
- skip turns
- win condition at/crossing finish
- background audio with mute/unmute
- mobile-friendly layout
- tests for rules, board path integrity, and room/session behavior
