# THC GrowLens

GrowLens is a mobile-first, local-first cultivation management PWA. It is intentionally isolated from the High Land game under `apps/growlens-web`.

## Included

- Responsive dashboard and mobile navigation
- Grow spaces, cycles, and plant records
- Searchable diary
- Tasks and due dates
- Environment readings
- VPD and DLI calculators
- Lux-to-PPFD estimates with saved calibration profiles
- 3 × 3 canopy mapping and uniformity calculation
- Structured plant observation and transparent diagnostic rules
- Camera/file photo observations
- Browser-side photo resizing, JPEG re-encoding, and original metadata removal
- Offline photo blobs in IndexedDB
- Optional authenticated private photo upload on Hostinger
- JSON backup and restore for grow records
- Versioned browser storage
- PWA manifest, privacy-safe service worker, and offline shell
- Optional Hostinger accounts and cross-device synchronization
- Explicit local/server conflict resolution: keep device, keep account, or merge
- Account export, logout, and password-confirmed deletion
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

## Important limitations

- Cross-device sync and private images require the PHP API to be deployed and configured with private storage outside `public_html`.
- JSON account sync carries photo IDs and observations, but the image bytes use separate authenticated endpoints.
- A JSON-only backup does not contain IndexedDB photo blobs. Private account images require a separate server directory backup until a packaged media-export feature is added.
- Lux-to-PPFD and phone-camera readings are estimates that require fixture/device-specific calibration.
- Diagnostic results are possible causes, not confirmed diagnoses.
- Browser notifications and automatic background synchronization are not active yet.

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

## Remaining production gates

- Packaged export/import for local IndexedDB photo blobs
- Server-media backup monitoring and restore drill
- Conflict-safe automatic background synchronization
- Two-account and two-device live isolation tests
- Larger photo galleries, comparison views, and time-series reports
- Browser notifications and recurring task reminders

Never put server secrets, password hashes, raw session tokens, private images, or private storage paths into browser code or public files.
