# THC GrowLens

GrowLens is a mobile-first, local-first cultivation management PWA. It is intentionally isolated from the High Land game under `apps/growlens-web`.

## Included

- Responsive dashboard and mobile navigation
- Grow spaces, cycles, and plant records
- Searchable diary and unified plant timelines
- One-time and recurring tasks with completion history
- Honest active-page browser reminders
- Environment readings and trend reports
- VPD and DLI calculators
- Lux-to-PPFD estimates with saved and reference-meter-derived calibration profiles
- 3 × 3 canopy mapping and uniformity calculation
- Structured plant observation and transparent diagnostic rules
- Camera/file photo observations
- Browser-side photo resizing, JPEG re-encoding, and original metadata removal
- Offline photo blobs in IndexedDB
- Optional authenticated private photo upload on Hostinger
- Plant-filtered photo history and chronological side-by-side comparison
- Printable reports and CSV exports
- JSON record backup and restore
- Complete backup and atomic restore for records plus local IndexedDB photos
- Versioned browser storage
- PWA manifest, privacy-safe service worker, and offline shell
- Optional Hostinger accounts and cross-device synchronization
- Explicit local/server conflict resolution: keep device, keep account, or merge
- Account export, logout, and password-confirmed deletion
- Guarded Hostinger deployment, private-data snapshots, and recovery-audit tooling
- PHP, unit, and Playwright browser tests

## Local-first behavior

GrowLens continues saving grow records and compressed observation photos on this device whether an account is connected or not. Account sync and private image upload are optional.

Grow record JSON is stored in localStorage. Compressed photo blobs are stored separately in IndexedDB so images do not inflate or corrupt the core grow-state record.

The account panel never silently overwrites different record copies. When this device and the account disagree, the user can:

1. download a local backup;
2. use the account copy;
3. keep this device copy; or
4. merge both copies by record ID.

Merging retains every unique record ID. When the same ID differs, the device version is retained and the merged result is uploaded as a new server revision.

## Photo privacy and processing

Accepted camera sources are JPEG, PNG, and WebP up to 15 MB. Before local storage or upload, the browser:

1. decodes the selected image;
2. limits the longest edge to 1600 pixels;
3. draws the image into a new canvas;
4. re-encodes it as JPEG at a controlled quality; and
5. stores the new blob without the original file metadata.

Private uploads are limited again by the PHP server. The server validates the detected MIME type, dimensions, and size before placing the image in the authenticated user's directory outside `public_html`.

Private images are streamed only through an authenticated endpoint with `Cache-Control: private, no-store`. The PWA service worker excludes all `/api/` traffic.

Deleting a server account also deletes its private image directory. Deleting an individual photo removes its local blob, observation link, and private server copy when one exists. GrowLens blocks the local deletion when it cannot authenticate deletion of a possible private copy.

The photo-history module reads local blobs through temporary object URLs and private images through the existing authenticated endpoint. It does not copy image bytes into localStorage or synchronized JSON.

## Important limitations

- Cross-device sync and private images require the PHP API to be deployed and configured with private storage outside `public_html`.
- JSON account sync carries photo IDs and observations, while image bytes use separate authenticated endpoints.
- Complete local backups include local IndexedDB photo bytes. Private server images still require the server-side private-data backup process.
- Lux-to-PPFD and phone-camera-derived readings are estimates that require fixture/device-specific calibration.
- Diagnostic results are possible causes, not confirmed deficiencies, diseases, or pests.
- Browser reminders currently depend on the app being open; closed-app push delivery is not active.
- Synchronization is user-controlled. Conflict-safe automatic background synchronization is not active.

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

## Data model

The root record is `GrowLensState` with `schemaVersion: 1`. Local records are stored under:

```txt
thc-growlens-state-v1
```

Offline photo blobs use:

```txt
IndexedDB database: growlens-media-v1
Object store:       photos
```

The state schema separates spaces, cycles, plants, diary entries, tasks, environment readings, calibration profiles, and observations. Observations can reference one or more stable photo IDs. Server snapshots wrap the JSON state with a revision and update timestamp.

## Deployment target

Deploy the complete contents of `apps/growlens-web/dist` to:

```txt
https://dtfseeds.com/growlens/
```

Do not omit hidden files. The API `.htaccess` file is part of the security boundary.

Configure the private backend according to:

```txt
docs/GROWLENS_HOSTINGER_BACKEND.md
```

The Vite build uses relative asset paths so the app can run below a subdirectory. The service worker excludes all `/api/` traffic and respects `Cache-Control: no-store`; authenticated records and images must never enter the offline shell cache.

Production deployment is intentionally manual and guarded. Run the `Deploy GrowLens to Hostinger` workflow from `main`, enable the deployment input, and supply the required confirmation phrase only after the release checks pass.

## Remaining production gates

- Run the guarded production deployment and complete a live desktop/mobile smoke test
- Run the protected two-account/two-device live isolation acceptance workflow
- Confirm scheduled private-media backups on Hostinger and perform a documented live restore drill
- Add conflict-safe automatic background synchronization without silent overwrites
- Add closed-app reminder delivery only if it can be implemented without weakening privacy or adding unnecessary recurring costs
- Expand structured irrigation, feeding, harvest, and observation-outcome records
- Validate light-estimation calibration on real supported devices and publish an honest compatibility list

Never put server secrets, password hashes, raw session tokens, private images, or private storage paths into browser code or public files.
