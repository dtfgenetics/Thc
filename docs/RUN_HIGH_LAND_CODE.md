# Run High Land Code

Use this guide when Codex is unavailable or timing out.

## Source

- Repo: `dtfgenetics/Thc`
- App: `apps/high-land-web`
- Route: `/games/high-land/`
- Live target: `https://dtfseeds.com/games/high-land/`

## Required checks

From the repository root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

The active High Land gate is deterministic Vitest plus TypeScript/Vite build, room API security checks, PHP lint in CI, static asset checks, and the browser-tool policy. Do not install or run Playwright for High Land.

## Preview locally

```bash
npm run dev:high-land
```

Open the forwarded dev-server URL. The production route after packaging is `/games/high-land/`.

## Manual browser review

After tests/build pass, manually confirm:

- Landing screen shows High Land: The Sweet Escape.
- Local 2-player and 10-player setup start.
- Roll Dice moves the active token exactly the rolled spaces.
- Landing on HIT reveals and applies a HIT card.
- Player turn advances; skip, draw-again, choice, and Reverse Rotation effects do not get stuck.
- Board controls remain usable on mobile width.
- No required board/card/audio asset is missing.

## GitHub Actions

Run **High Land CI** manually from the Actions tab. It installs with `npm ci`, runs deterministic tests, builds, verifies room API security, lints PHP files when present, verifies the built entrypoint/static assets, and uploads the dist artifact.

## Live deployment boundary

A repo merge or artifact is not a live update. Live success requires deploying the built `apps/high-land-web/dist` contents to `public_html/games/high-land/` and then passing the live checks in `docs/deployment-hostinger.md`.

## What to send any coding app

```txt
Open dtfgenetics/Thc. Focus on apps/high-land-web. Run npm ci, npm run test:high-land, npm run build:high-land, and node scripts/verify-browser-tool-policy.mjs from the repo root. Fix TypeScript, Vitest, Vite build, room API security, asset path, and deterministic gameplay errors only. Do not install or run Playwright for High Land. Preserve local play, create room, invite link, add test player, lobby start, transport-backed room roll/restart, exact dice movement, HIT card effects, and turn order. Do not commit secrets. After fixing, summarize every changed file and the test/build output.
```
