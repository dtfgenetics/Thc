# Deployment Runbook

## Build

Run from the repository root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

## Output

```txt
apps/high-land-web/dist
```

## Upload target

```txt
/public_html/games/high-land/
```

## Public URL

```txt
https://dtfseeds.com/games/high-land/
```

## Check after upload

- Page loads.
- Board renders.
- Player setup starts.
- Dice roll works.
- HIT card reveal works.
- Reverse Rotation, choices, skip turns, and draw-again cards do not get stuck.
- Save and load work.
- Mobile view works.
- Browser console and required network requests pass live review.

A repository build is not a live update. Live success requires uploading `apps/high-land-web/dist` to `/public_html/games/high-land/` and verifying the public route.
