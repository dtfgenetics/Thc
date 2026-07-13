# DTF / THC Connection Setup Guide

Created: 2026-06-21

This repo is the code source of truth for the browser game project. Google Drive is the asset source of truth. Codex should use this file before making changes so it does not rebuild the wrong game or use scattered screenshots.

## Verified connections

- GitHub account: `dtfgenetics`
- Repo: `dtfgenetics/Thc`
- Default branch: `main`
- App path from README: `apps/high-land-web`
- Drive master source folder: `DTF Project Asset Library - MASTER SOURCE`
- Drive High Land folder: `High_Land`

## Correct order of operations

1. **Google Drive assets** are the source of truth for approved boards, card art, printable files, icons, logos, audio, and archived assets.
2. **GitHub repo** is the source of truth for website and game code.
3. **Codex local project folder** must be the GitHub-backed clone of this repo, not a random folder or one-off export.
4. **Hostinger deployment** should deploy tested builds from GitHub, not manual file uploads.
5. **Backend service** should handle High Land multiplayer rooms, player names, invite links, and shared game state.
6. **Discord app/bot** should only connect after the website invite flow works.
7. **Analytics/Search Console** should be added after the game works reliably.

## Locked backend

Use the Hostinger PHP Website Room API already committed and deployed with the
High Land build. `docs/BACKEND_DECISION.md` is authoritative.

- Source: `apps/high-land-web/public/api/`
- Client: `websiteRoomTransport.ts`
- Live API: `https://dtfseeds.com/games/high-land/api/`
- Production mode: `website`
- Local/offline mode: `local`

Do not reconnect Supabase. The older Supabase material is historical planning.

## High Land required features

High Land must support:

- player name entry before joining a game
- 2–4 local or online players
- invite link / room code flow
- shared game room state
- dice roll movement where spaces moved exactly match the roll
- tokens that sit on board spaces, not off to the side
- board text/prices that sit inside their own box and do not overlap neighboring spaces
- mobile layout that keeps board, controls, cards, and players readable

## Deployment rules

- Do not deploy untested Codex changes directly to production.
- Build locally or in CI first.
- Test `/games/high-land/` before production deploy.
- Keep a rollback path to the last known-good commit.
- Archive wrong/broken versions instead of deleting them.

## Codex instructions

Before changing game code, Codex should:

1. Read this file.
2. Read `docs/HIGH_LAND_ACCEPTANCE_CHECKLIST.md`.
3. Inspect `apps/high-land-web`.
4. Verify the Hostinger room API guard endpoints and website transport tests.
5. Avoid replacing the approved High Land game with placeholder or unrelated game code.
