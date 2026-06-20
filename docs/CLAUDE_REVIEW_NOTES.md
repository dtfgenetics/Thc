# Claude Review Notes

This repo is not finished yet. It is ready for a code review and terminal verification pass.

## Check first

From `apps/high-land-web` run:

```bash
npm install
npm run test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

## Known fixes already applied

- Playwright files were added.
- `@playwright/test` and `test:e2e` were added to `package.json`.
- Production Vite base path is `/games/high-land/`.
- Board asset paths use the Vite base path helper.
- Dice and card reveal components are wired into the app.

## Things to review carefully

- TypeScript build errors.
- Phaser loader behavior when the board PNG is missing.
- Whether the browser test URL works with the production base path.
- CSS polish for dice and card reveal.
- Board coordinates after final board image is imported.

## Do not replace

- Do not replace the High Land game with a generic template.
- Do not remove 10 player support.
- Do not remove the existing card effect system.
- Do not add online multiplayer before local tests pass.
