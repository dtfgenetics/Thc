# Deployment Runbook

## Build

```bash
cd apps/high-land-web
npm install
npm run test
npm run build
npm run test:e2e
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
- Ten-player mode starts.
- Dice roll works.
- Card reveal works.
- Save and load work.
- Mobile view works.
