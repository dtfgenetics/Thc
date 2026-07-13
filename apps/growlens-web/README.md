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
- JSON backup and restore
- Versioned browser storage
- PWA manifest, privacy-safe service worker, and offline shell
- Optional Hostinger accounts and cross-device synchronization
- Explicit local/server conflict resolution: keep device, keep account, or merge
- Account export, logout, and password-confirmed deletion
- PHP, unit, and Playwright browser tests

## Local-first behavior

GrowLens continues saving to this browser whether an account is connected or not. Account sync is optional.

The account panel never silently overwrites different copies. When this device and the account disagree, the user can:

1. download a local backup;
2. use the account copy;
3. keep this device copy; or
4. merge both copies by record ID.

Merging retains every unique record ID. When the same ID differs, the device version is retained and the merged result is uploaded as a new server revision.

## Important limitations

- Cross-device sync requires the PHP API to be deployed and configured with private storage outside `public_html`.
- Observation photos are previewed in memory but are not stored in this release.
- Lux-to-PPFD and phone-camera readings are estimates that require fixture/device-specific calibration.
- Diagnostic results are possible causes, not confirmed diagnoses.
- Browser notifications and background synchronization are not active yet.

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

Backend smoke test:

```bash
php apps/growlens-web/tests/php-backend-smoke.php
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

The schema separates spaces, cycles, plants, diary entries, tasks, environment readings, calibration profiles, and observations. Server snapshots wrap that state with a revision and update timestamp.

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

The Vite build uses relative asset paths so the app can run below a subdirectory. The service worker excludes all `/api/` traffic and respects `Cache-Control: no-store`; authenticated API responses must never enter the offline cache.

## Remaining production gates

Before storing photos or adding automated background sync, implement and verify:

- Private image storage outside public browsing
- File signature, MIME type, dimension, and size validation
- Metadata stripping and image compression
- Per-user image authorization
- Image deletion with account deletion
- Backup and migration handling for images
- Conflict-safe background synchronization
- Two-account and two-device live isolation tests

Never put server secrets, password hashes, raw session tokens, or private storage paths into browser code.
