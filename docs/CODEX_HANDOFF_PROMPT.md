# Codex Handoff Prompt

You are finishing the High Land browser game.

Start here:

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run dev
```

Fix errors in this order:

1. TypeScript errors.
2. Unit test failures.
3. Browser test failures.
4. Asset path errors.
5. Phaser render errors.
6. Mobile layout errors.

Do not replace the game concept.

Keep:

- 2 to 10 players.
- Single continuous board path.
- Dice rolling.
- Action cards.
- Skip turns.
- Save and load.
- Deployment under `/games/high-land/`.

After it runs, add the final board image and calibrate `boardPath.ts`.
