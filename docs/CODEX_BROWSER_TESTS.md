# High Land Browser Review — No Playwright

Playwright is retired from the active High Land validation path. Use deterministic repository checks first, then perform manual browser review against the exact artifact or live route.

## Repository checks

Run from the repository root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

## Manual browser review goals

Prove these behaviors in a real browser before calling the artifact presentation-ready:

- The app loads with the High Land identity.
- Player setup supports local play.
- 10-player mode can start.
- A dice roll changes the board state by the exact rolled distance.
- Landing on HIT reveals and applies a HIT card.
- Reverse Rotation works across dice turns, HIT-card turns, and pending choices.
- Mobile layout can start, roll, and restart without blocking controls.
- The production build works under `/games/high-land/` after deployment.

If browser review fails, fix app code first, then adjust review instructions only if the behavior requirement was wrong.
