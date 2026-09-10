# High Land Engineering Handoff

Repository: `dtfgenetics/Thc`

Read `docs/GAME_DEVELOPMENT_FREEDOM.md` first. High Land may be repaired, redesigned, migrated, or rebuilt as needed to meet the current product goal. Existing React, Phaser, board data, multiplayer transport, routes, files, and assets are current implementation details rather than mandatory architecture.

## Current location

The current implementation is under `apps/high-land-web` and the current public target is `https://dtfseeds.com/games/high-land/`. If the implementation or route changes, update repository and deployment metadata to match.

## Engineering goal

Deliver a polished, responsive High Land game that works on phone, tablet, laptop, and desktop; has clear gameplay state and controls; passes the tests/build checks appropriate to the resulting architecture; and is verified on the exact public route before being called live.

## Current baseline checks

Use these when they still apply:

```bash
npm ci
npm run test:high-land
npm run build:high-land
```

Add, remove, or replace validation tools when the architecture changes. Browser automation, manual browser review, static analysis, visual regression, device testing, and other QA approaches may all be used when useful.

## Current implementation map

Useful current files include:

```txt
apps/high-land-web/src/main.tsx
apps/high-land-web/src/App.tsx
apps/high-land-web/src/styles.css
apps/high-land-web/src/ui/
apps/high-land-web/src/game/
apps/high-land-web/public/api/
```

These paths are not locked and may be reorganized.

## Quality targets

Verify the intended current gameplay rules, movement, turn resolution, multiplayer behavior, save/reconnect behavior, visual clarity, responsive layout, controls, audio/settings, and win/finish states. If the design changes, update tests and documentation to validate the new intended behavior instead of preserving obsolete assumptions.

Security and release integrity still matter: do not expose credentials or private room/user data, protect multiplayer authority appropriately, and do not claim a production change is live until the exact visitor-facing route has been exercised and verified.

## Report

Record what changed, what tests/builds/browser checks ran, any remaining defects, and whether live-route verification passed, failed, or was not tested.
