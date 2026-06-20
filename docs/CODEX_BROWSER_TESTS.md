# Browser Test Instructions

Codex should run these from the web app folder:

```bash
npm install
npx playwright install --with-deps chromium
npm run test
npm run build
npm run test:e2e
```

The browser tests should prove:

- The app loads.
- Ten player mode starts.
- A dice roll changes the board state.
- Mobile layout can start and restart.
- The production build works under `/games/high-land/`.

If tests fail, fix app code first, then test code second.
