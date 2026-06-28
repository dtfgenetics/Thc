# Deploy High Land to Hostinger

This runbook separates repository/build success from live-site success. Never use
a passing local build or GitHub Actions run as evidence that the public game was
updated.

## Deployment contract

- Source repository: `dtfgenetics/Thc`
- Production branch: `main`
- Build command: `npm run build:high-land`
- Build output: `apps/high-land-web/dist`
- Hostinger target: `public_html/games/high-land/`
- Public URL: `https://dtfseeds.com/games/high-land/`

Do not modify WordPress core, WooCommerce data, root `.htaccess`, `wp-config.php`,
themes, plugins, or unrelated site content for a High Land deployment. Keep room
storage and credentials outside `public_html`.

## Phase 1: local and CI validation

Run from the repository root:

```bash
npm ci
npm run test:high-land
npm run build:high-land
npm run test:e2e:high-land
```

If PHP exists, lint each room API file with `php -l`. Record the commit SHA and
the exact CI run. A Phase 1 PASS means only that the tested checkout produced a
valid local artifact. It does not mean the public URL changed.

Before upload, confirm that `apps/high-land-web/dist/index.html` exists, the Vite
production base is `/games/high-land/`, required assets are present in `dist`,
and no secrets or local room files are included.

## Phase 2: backup and upload

1. Make a timestamped backup of the current live High Land directory.
2. Upload the **contents** of `apps/high-land-web/dist` into
   `public_html/games/high-land/`; do not add an extra `dist` directory level.
3. Preserve the built directory structure and binary assets.
4. Ensure PHP room endpoints are served as PHP when present.
5. Ensure private room storage is writable by the site account but is not web
   accessible.

An upload without Phase 3 evidence is **NOT TESTED**, not a successful live
deployment.

## Phase 3: live `/games/high-land/` verification

Test the public origin, not localhost or a local preview:

1. `https://dtfseeds.com/games/high-land/` returns success and loads its scripts,
   styles, board, card, audio, and font assets without 404 errors.
2. The game shows the expected High Land identity and no unrelated content.
3. A named local game rolls, moves the exact distance, triggers a HIT card, and
   reaches a valid turn state.
4. A host creates a new room and shares its `?game=ROOMCODE` URL.
5. A separate browser profile or device joins; both clients see the same lobby.
6. Start the room and verify active-player authority, dice, movement, HIT card,
   skips/choices, turn order, refresh/reconnect, and winner synchronization.
7. Verify a mobile viewport has no horizontal overflow or blocked controls.
8. Confirm the browser console and network panel have no uncaught errors or
   failed required requests.
9. Confirm public room responses contain no tokens, credentials, or secrets.

Only a PASS for all applicable Phase 3 checks supports the statement **live
`/games/high-land/` verification passed**.

## Rollback

If any required live check fails:

1. Record the failing deployed SHA, URL, console/network evidence, and time.
2. Restore the timestamped backup.
3. Verify the restored route.
4. Mark live deployment FAIL and repair through a reviewed repository change.

## Deployment record

- Commit SHA:
- CI run:
- Build result: PASS / FAIL / NOT TESTED
- Backup path:
- Upload time:
- Live verification result: PASS / FAIL / NOT TESTED
- Two-browser/device evidence:
- Mobile/console evidence:
- Rollback reference:
- Remaining issues:
