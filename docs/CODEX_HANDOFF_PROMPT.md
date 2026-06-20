# Codex Handoff Prompt

You are finishing the High Land browser game.

## Important

Ignore scattered brainstorming docs unless they are listed below. The source of truth is the app code plus these files:

```txt
apps/high-land-web/
docs/CODEX_HANDOFF_PROMPT.md
docs/VISUAL_LOCK.md
docs/ASSET_IMPORT_CHECKLIST.md
docs/DEPLOYMENT_RUNBOOK.md
docs/PLAYTEST_MATRIX.md
```

## Start here

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

## Fix errors in this order

1. TypeScript errors.
2. Unit test failures.
3. Production build errors.
4. Browser test failures.
5. Phaser render errors.
6. Asset path errors.
7. Mobile layout errors.

## Keep

- 2 to 10 players.
- Single continuous board path.
- Dice rolling.
- Action cards.
- Skip turns.
- Save and load.
- Deployment under `/games/high-land/`.

## Do not do

- Do not replace the game with a generic template.
- Do not add online multiplayer before local mode passes.
- Do not remove the current rules engine.
- Do not build from old website code unless it is confirmed correct.

## After it runs

1. Add the final board image.
2. Calibrate `src/game/data/boardPath.ts` to the image.
3. Add card artwork.
4. Polish dice and card display CSS.
5. Upload `dist` to `/games/high-land/`.
