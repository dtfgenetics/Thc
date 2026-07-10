# Hostinger Staging Deployment Runbook

This runbook deliberately deploys to temporary Hostinger URLs first. Do not remove the existing `dtf420.com` Website Builder site and do not change DNS until the staging acceptance checklist passes.

## Current deployment shape

Deploy two Node.js Web Apps from the same GitHub repository and branch:

1. **High Land API** — persistent Express process from `apps/high-land-server`.
2. **High Land web client** — static Vite build from `apps/high-land-web`.

Use branch:

```text
feat/game-hub-multiplayer-foundation
```

The branch remains a staging branch until the pull request is reviewed and merged.

## App 1 — multiplayer API

In hPanel:

1. Open **Websites**.
2. Select **Add website**.
3. Select **Deploy Web App** or **Node.js Web App**, depending on the label shown in hPanel.
4. Import the GitHub repository `dtfgenetics/Thc`.
5. Select the staging branch.
6. If Hostinger does not detect the monorepo correctly, select framework type **Other**.
7. Use these settings:

```text
Install command: npm ci
Build command: npm run build:server
Output directory: apps/high-land-server/dist
Entry file: apps/high-land-server/dist/index.js
Node version: 22
```

Environment variables:

```text
ALLOWED_ORIGINS=https://<temporary-web-client-domain>
ROOM_DATA_FILE=./data/high-land-rooms.json
```

Do not manually set `PORT` when Hostinger supplies it. The application reads `process.env.PORT`.

After deployment, verify:

```text
https://<temporary-api-domain>/health
```

Expected response includes:

```json
{
  "ok": true,
  "service": "high-land-multiplayer",
  "apiVersion": "1.0.0"
}
```

`ROOM_DATA_FILE` is acceptable only for a single-instance staging smoke test. Do not call this production-ready persistence.

## App 2 — High Land web client

Create another **Deploy Web App** or **Node.js Web App** website from the same repository and branch.

Use:

```text
Install command: npm ci
Build command: npm run build:high-land
Output directory: apps/high-land-web/dist
Node version: 22
```

This is a static Vite application, so it does not need an entry file.

Set this build-time environment variable:

```text
VITE_MULTIPLAYER_API_URL=https://<temporary-api-domain>/api/v1
```

Then add the web client's exact origin to the API app's `ALLOWED_ORIGINS` value and redeploy/restart the API.

## Staging acceptance checklist

Use two genuinely separate browser contexts, preferably two devices or a normal window plus an incognito window.

- [ ] The API health endpoint returns HTTP 200.
- [ ] The web client loads without console errors.
- [ ] Browser A creates a room.
- [ ] Browser A receives a six-character room code.
- [ ] Browser B joins with that code.
- [ ] Both browsers display both players and ready state.
- [ ] The host can start after both players are ready.
- [ ] A non-host cannot start.
- [ ] Only the current player can roll.
- [ ] The server, not browser input, determines the die result.
- [ ] Both browsers show the same movement and next turn.
- [ ] HIT-card draws and effects match on both browsers.
- [ ] Refreshing Browser A reconnects the same player.
- [ ] Refreshing Browser B reconnects the same player.
- [ ] Rapidly double-clicking Roll does not produce two moves.
- [ ] A stale action is rejected rather than overwriting newer state.
- [ ] Restarting the API preserves a staging room when `ROOM_DATA_FILE` is enabled.
- [ ] Phone layout remains usable.
- [ ] A complete game can reach the actual final board index, 108.

## Known blockers before public production

The approved 109-space board, all 39 HIT-card definitions, server-side card resolution, movement, turns and winning are now in the authoritative service. They still require a clean repository-wide CI run and a real two-device staging game before public release.

The JSON snapshot adapter is not a production database. Before public release, add a durable database repository and verify atomic version updates there.

## Domain cutover

Only after staging passes:

1. Back up the current `dtf420.com` Website Builder site.
2. Preserve screenshots and current content for rollback.
3. Merge the reviewed pull request.
4. Deploy the production branch to temporary URLs again.
5. Connect `dtf420.com` to the web app.
6. Connect an API hostname such as `api.dtf420.com` to the API app, or configure same-origin routing.
7. Update `VITE_MULTIPLAYER_API_URL` and `ALLOWED_ORIGINS` with the production HTTPS URLs.
8. Verify SSL, room creation and two-player synchronization after DNS propagation.
9. Keep the old site available until the first production multiplayer game completes successfully.

## Rollback

If production fails:

1. Stop sending players to the new hub.
2. Reconnect the previous domain target or restore the prior Hostinger website backup.
3. Leave `dtfseeds.com` unchanged.
4. Preserve API logs and the failed deployment commit SHA.
5. Fix on a branch and repeat staging; do not patch production manually.
