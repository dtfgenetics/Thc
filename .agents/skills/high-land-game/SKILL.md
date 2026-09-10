---
name: high-land-game
description: Build, redesign, repair, verify, and release High Land: The Sweet Escape across gameplay, UI, multiplayer, assets, tests, CI, and deployment in dtfgenetics/Thc.
---

# High Land game workflow

Read `docs/GAME_DEVELOPMENT_FREEDOM.md` first. High Land has no project-imposed implementation lock. Existing game rules, route geometry, renderer, backend, file layout, assets, player limits, deployment path, and testing tools may be changed when that better serves the current requested goal.

## Workflow

1. Inspect the current implementation, recent changes, live/public state, assets, tests, and deployment metadata enough to understand what exists.
2. Identify the current product goal and the player-facing problems to solve.
3. Decide whether to repair, refactor, migrate, consolidate, or rebuild the relevant systems.
4. Change whichever gameplay, UI, renderer, multiplayer, asset, data, architecture, route, or build layers are necessary.
5. Update tests and validators so they check the resulting intended behavior rather than obsolete implementation details.
6. Verify responsive behavior on phone, tablet, laptop, and desktop when presentation is in scope.
7. Verify multiplayer with independent sessions when multiplayer is in scope.
8. Build/package and verify the exact public route separately before claiming a production change is live.

## Current references

The current implementation is under `apps/high-land-web` and current baseline commands include:

```bash
npm ci
npm run test:high-land
npm run build:high-land
```

These are current conveniences, not immutable requirements. Replace or expand them when the implementation changes. Any appropriate browser, rendering, test, profiling, or QA tool may be used.

## Quality expectations

Aim for a polished game-first presentation with clear state, responsive controls, reliable gameplay, intentional phone/tablet/desktop composition, strong art and feedback, and no broken assets. Preserve existing systems only when they help the target result.

Protect credentials, authorization, private multiplayer state, and user data in whichever architecture is chosen. Report repository validation and live-route validation separately.
