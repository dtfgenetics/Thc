# THC GrowLens

GrowLens is a mobile-first, local-first cultivation management PWA. It is isolated from the High Land game under `apps/growlens-web` and is designed to deploy on the existing Hostinger account without a new monthly backend service.

## Included

- Responsive dashboard and mobile navigation
- Grow spaces, cycles, plants, stages, and statuses
- Searchable diary and unified plant timelines
- One-time and recurring tasks with completion history
- Honest active-page browser reminders
- Environment readings and trend reports
- VPD and DLI calculators
- Lux-to-PPFD estimates with saved and reference-meter-derived calibration profiles
- 3 × 3 canopy mapping and uniformity calculation
- Structured symptom intake and transparent possible-cause rules
- Observation outcomes: monitoring, confirmed, ruled out, and resolved
- Camera/file photo observations
- Browser-side image resizing, JPEG re-encoding, and original metadata removal
- Offline IndexedDB photo storage
- Optional authenticated private photo upload on Hostinger
- Plant-filtered photo history and chronological comparison
- Structured irrigation and runoff records
- Structured feeding and nutrient-mix records
- Reservoir/tank records
- Harvest, drying, cure, lot, and yield records
- Descriptive analytics by plant, cultivar, cycle, and grow space
- Printable reports and CSV exports for all record families
- JSON record backup and restore
- Complete backup and atomic restore for records plus local IndexedDB photos
- Optional Hostinger accounts with revision-aware synchronization
- Explicit keep-device, keep-account, and merge conflict controls
- Optional conflict-safe active-page auto-sync with an IndexedDB intent queue
- Account export, logout, and password-confirmed deletion
- Guarded Hostinger deployment, private-data snapshots, and recovery-audit tooling
- PHP, unit, and Playwright desktop/mobile tests

## Local-first behavior

GrowLens saves records and compressed observation photos on the current device whether an account is connected or not. Account sync and private image upload are optional.

Grow records use localStorage. Compressed image blobs use IndexedDB so photo bytes do not inflate or corrupt the core state record.

The account panel never silently overwrites different copies. When device and account data disagree, the user can download a backup and then keep the device copy, keep the account copy, or merge by stable record ID. Matching IDs retain the current-device version during a manual merge.

## Safe active-page auto-sync

Safe auto-sync is optional and disabled by default. When enabled, GrowLens creates a small IndexedDB intent containing only the account ID, reconciled revision/hash, current local hash, retry status, and timestamps. It never stores a password, session cookie, CSRF token, private storage path, image byte, or obsolete request body.

Before every automatic upload GrowLens:

1. acquires a same-origin Web Lock where supported;
2. reads the latest local state;
3. fetches a fresh authenticated session and CSRF token;
4. pulls the current server revision and normalized state;
5. uploads only when the server still matches the last reconciled baseline; and
6. stops for manual review on authentication changes, revision conflicts, or differing remote state.

Status changes are shared with other open tabs through BroadcastChannel. Attempts run on app start, local changes, reconnect, focus, and visibility while GrowLens is open. This is not closed-app background synchronization.

## Schema version 2

The normalized root record is `GrowLensState` with `schemaVersion: 2`.

The existing local-storage key remains:

```txt
thc-growlens-state-v1
```

Keeping the key prevents existing local journals from becoming unreachable. Every read migrates schema-version 1 data into schema version 2 by retaining existing collections and initializing:

```txt
irrigationRecords
feedingRecords
reservoirRecords
harvestRecords
observationOutcomes
```

The same collections are included in account sync, conflict merges, JSON exports, complete local backups, printable reports, plant timelines, analytics, and CSV datasets.

## Structured record units

GrowLens stores explicit units rather than guessing:

- water and runoff volume: milliliters
- reservoir volume: liters
- EC: mS/cm
- pH: unitless 0–14 scale
- moisture, humidity, dryback, and runoff: percentage
- temperature: degrees Celsius
- harvest and yield weights: grams
- PPM: value plus explicitly recorded 500 or 700 scale

Runoff percentage and wet-to-dry loss are derived values. They are not saved as independent measurements.

## Photo privacy

Accepted camera sources are JPEG, PNG, and WebP up to 15 MB. Before local storage or upload, the browser decodes the image, limits the longest edge, draws it into a new canvas, re-encodes it as JPEG, and retains the new blob without original source metadata.

Private uploads are validated again by PHP and stored in the authenticated user’s directory outside `public_html`. Private images are streamed only through an authenticated endpoint with `Cache-Control: private, no-store`. The service worker excludes all `/api/` traffic.

## Commands

From the repository root:

```bash
npm ci
npm run dev:growlens
npm run test:growlens
npm run build:growlens
npm run test:e2e:growlens
npm run verify:growlens
```

Backend smoke tests:

```bash
php apps/growlens-web/tests/php-backend-smoke.php
php apps/growlens-web/tests/php-state-v2-smoke.php
php apps/growlens-web/tests/php-image-storage-smoke.php
php apps/growlens-web/tests/php-private-data-tools-smoke.php
```

Development URL:

```txt
http://localhost:5174
```

Production output:

```txt
apps/growlens-web/dist
```

## Deployment

Deploy the complete contents of `apps/growlens-web/dist` to:

```txt
https://dtfseeds.com/growlens/
```

Do not omit hidden files. The API `.htaccess` file, `_shared.php`, `_state-v2.php`, and `_images.php` are part of the security boundary.

Configure private storage according to `docs/GROWLENS_HOSTINGER_BACKEND.md`. Production deployment is manual and guarded. Run the `Deploy GrowLens to Hostinger` workflow from `main`, enable deployment, and enter the required confirmation phrase only after all release checks pass.

## Accuracy and safety boundaries

- Lux-to-PPFD and phone-camera-derived readings are estimates requiring fixture/device-specific calibration.
- Diagnostic results are possible causes, not confirmed deficiencies, diseases, or pests.
- Analytics are descriptive and do not prove that a cultivar, environment, feeding, irrigation event, or treatment caused an outcome.
- PPM values are not meaningful without the recorded conversion scale.
- Browser reminders require the app to be open or active; closed-app push delivery is not active.
- Safe auto-sync requires an open/active GrowLens page and never silently resolves different copies.
- Never put server secrets, password hashes, raw session tokens, private images, or private storage paths into browser code or public files.

## Remaining production gates

- Run the guarded production deployment and complete a live desktop/mobile smoke test
- Run protected two-account/two-device live isolation against schema version 2
- Validate safe auto-sync against real concurrent devices and forced offline/reconnect conditions
- Confirm scheduled private-media backups and perform a documented restore drill
- Validate camera capture, IndexedDB durability, PWA installation, and light calibration on real devices
- Add closed-app reminders only after privacy and Hostinger capability review
- Add matched-angle photo guidance, annotations, and multi-date comparison sets
