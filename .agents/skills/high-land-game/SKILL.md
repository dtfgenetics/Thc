---
name: high-land-game
description: Preserve and verify High Land: The Sweet Escape for every game, UI, multiplayer, asset, test, CI, review, release, or Hostinger deployment change in dtfgenetics/Thc.
---

# High Land game workflow

Follow this sequence before changing High Land:

1. Read `AGENTS.md`, `CLAUDE.md`, and `README.md`.
2. Read `docs/HIGH_LAND_CODEX_NOW.md`, `docs/CODEX_HIGH_LAND_GAME_BUILD.md`,
   `docs/SYSTEMS_READINESS.md`, and `docs/TOOL_CONNECTIONS.md`.
3. Read `docs/high-land-spec.md` and
   `docs/high-land-acceptance-checklist.md`.
4. Read `docs/deployment-hostinger.md` for deployment or live-site work.
5. Inspect the current branch, working tree, relevant source, tests, assets, and
   existing CI failures. Preserve unrelated and user-authored changes.
6. Classify the task as controls-only, gameplay, UI/visual, multiplayer, or
   deployment. Do not edit gameplay during a controls-only task.
7. Compare the request with the locked spec. Report a conflict before changing a
   locked product rule.
8. Make the smallest in-scope change in the correct layer and update tests for
   changed behavior.

Preserve the title, single continuous route, seven-location order, exact dice
movement, on-board token coordinates, HIT behavior, player names, and invite
authority defined in the spec. Do not add another game's content or expose
secrets/session credentials.

Run from the repository root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
npm run test:e2e:high-land
```

Run PHP lint when PHP files exist. Use the acceptance checklist and record each
applicable item as PASS, FAIL, or NOT TESTED with evidence.

Report changed files, command results, screenshots/browser evidence, local
status, live status, and remaining issues. Treat local success and live
`/games/high-land/` verification as separate gates. Never claim completion when
a required check failed or was not tested.
