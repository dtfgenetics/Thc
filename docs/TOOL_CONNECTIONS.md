# Tool Connection Map

This document keeps the DTF / THC games workspace aligned across GitHub, Codex, Hostinger, WordPress, Google Drive, and future Discord work.

## Portfolio source of truth

Before changing project structure, storage, or cross-tool ownership, read [`docs/PROJECT_SOURCE_OF_TRUTH.md`](PROJECT_SOURCE_OF_TRUTH.md).

The Google Drive folder `DTF Project Asset Library - MASTER SOURCE` is the canonical human/source system. GitHub repositories are the canonical code and machine-readable data systems. ChatGPT Library, Figma, Base44, hosted builders, and image-generation tools are working/production surfaces rather than the only archive.

## Source of truth

| System | Status | Connection |
| --- | --- | --- |
| GitHub repo | Connected | `dtfgenetics/Thc` |
| Production branch | Connected | `main` |
| High Land app | Connected in repo | `apps/high-land-web` |
| Multiplayer backend | Connected/live | Hostinger PHP Website Room API |
| CI | Configured | `.github/workflows/high-land-ci.yml` |
| Deployment target | Manual verification required | Hostinger / WordPress / `dtfseeds.com` |
| Google Drive human source | Connected | `DTF Project Asset Library - MASTER SOURCE` |
| Discord | Not connected yet | Add after browser multiplayer works |

## Multiplayer backend

The locked backend is the existing same-origin Hostinger PHP Website Room API.
See `docs/BACKEND_DECISION.md`. Supabase is not active and `.mcp.json` is removed.

## Required local environment variables

For the Vite browser app, use public browser-safe values only:

```txt
# No multiplayer credential or API URL is required in the browser.
```

Do not commit `.env`, `.env.local`, service-role keys, secret keys, database passwords, Hostinger private keys, Discord bot tokens, OpenAI keys, or GitHub tokens.

## GitHub Actions variables and secrets

Use GitHub environment secrets only for private automation values:

```txt
HOSTINGER_SSH_PRIVATE_KEY
HOSTINGER_HOST
HOSTINGER_USER
HOSTINGER_PORT
DISCORD_BOT_TOKEN
OPENAI_API_KEY
```

## Hostinger / WordPress deployment

Manual checks still required in Hostinger:

1. Confirm it deploys from `dtfgenetics/Thc`.
2. Confirm branch is `main`.
3. Confirm build command is `npm run build:high-land`.
4. Confirm publish/output directory is `apps/high-land-web/dist`.
5. Confirm `dtfseeds.com/games/high-land/` points to the built app or WordPress embed path.
6. Confirm frontend env variables are set in Hostinger or the deployment pipeline, not committed.

## Connection order

1. GitHub repo and CI.
2. Hostinger PHP room API and website transport.
3. Hostinger deployment from GitHub.
4. WordPress route/embed.
5. Two-browser/device multiplayer acceptance.
6. Discord app or bot after the web flow works.

## Codex verification prompt

```txt
Work in `dtfgenetics/Thc`. Read `CLAUDE.md`, `README.md`, `docs/PROJECT_SOURCE_OF_TRUTH.md`, `docs/SYSTEMS_READINESS.md`, `docs/TOOL_CONNECTIONS.md`, and `docs/BACKEND_DECISION.md` first. The Google Drive `DTF Project Asset Library - MASTER SOURCE` is the canonical human/source system. GitHub is canonical for code and machine-readable data. The locked multiplayer backend is the Hostinger PHP Website Room API; do not reconnect Supabase. Verify High Land with `npm run verify:connections`, `npm run test:high-land`, and `npm run build:high-land`. Do not commit secrets. Report local, API, and live multiplayer validation separately.
```
