# GrowLens Release Plan

## Current release candidate

GrowLens is now a functional local-first PWA with an optional Hostinger account layer. The application is beyond the foundation-only stage: core grow records, offline photos, complete local backups, reports, recurring routines, private account synchronization, conflict controls, and production deployment safeguards are implemented and covered by automated tests.

The current release goal is a controlled production pilot at:

```txt
https://dtfseeds.com/growlens/
```

The product must still be described honestly:

- it is a cultivation management and observation tool;
- its diagnostic rules provide possible causes, not confirmed diagnoses;
- its light calculations and phone-derived estimates are not quantum-sensor measurements;
- account sync is optional and user-controlled;
- closed-app notifications and automatic background sync are not active.

## Implemented release scope

### Grow management

- Grow spaces, cycles, and plants
- Plant stage and status tracking
- Searchable diary
- One-time and recurring tasks
- Environment readings
- Unified plant history and reports
- CSV and printable exports

### Measurement tools

- VPD calculator
- DLI calculator
- Lux-to-PPFD estimation
- Saved calibration profiles
- Reference-meter calibration workflow
- 3 × 3 canopy mapping and uniformity calculation
- Environment trend charts

### Observations and photos

- Structured symptom intake
- Transparent possible-cause ranking with supporting and conflicting evidence
- Camera/file capture
- Browser-side image resizing and metadata removal
- Offline IndexedDB photo storage
- Optional authenticated private upload
- Photo deletion across local and private copies
- Plant-filtered photo history
- Chronological side-by-side progress comparison

### Privacy, recovery, and synchronization

- Local-first operation without an account
- Secure Hostinger registration, login, session, CSRF, and per-user authorization boundaries
- Revision-aware record synchronization
- Explicit keep-device, keep-account, and merge controls
- Account export and password-confirmed deletion
- JSON record backups
- Complete local backups containing records and local photo bytes
- Atomic restore and rollback protection
- Private-data snapshot, remote-backup, and recovery-audit tooling

### Delivery safeguards

- PWA manifest and offline shell
- Service-worker exclusion for all API traffic
- PHP linting and backend smoke tests
- Unit tests
- Desktop and mobile Playwright tests
- Protected destructive live-acceptance tooling
- Main-only guarded Hostinger deployment with staged activation and rollback

## Build artifact

```txt
apps/growlens-web/dist
```

The production package must contain the application shell, manifest, service worker, icon, PHP API, shared security helpers, image endpoints, and API `.htaccess` file.

## Standard verification

Run from the repository root:

```bash
npm ci
npm run verify:growlens
php apps/growlens-web/tests/php-backend-smoke.php
php apps/growlens-web/tests/php-image-storage-smoke.php
php apps/growlens-web/tests/php-private-data-tools-smoke.php
```

The verification is not complete unless all of the following pass:

1. TypeScript compilation and production build
2. Unit tests
3. PHP syntax checks
4. Account/backend smoke tests
5. Private-image storage smoke tests
6. Complete-backup and restore tests
7. Desktop browser tests
8. Mobile browser tests
9. Required production-file checks

## Controlled production release

Production deployment is intentionally not automatic after every merge.

1. Merge only a green GrowLens pull request into `main`.
2. Review the exact production commit.
3. Run the `Deploy GrowLens to Hostinger` workflow from `main`.
4. Enable the deployment input and enter the required confirmation phrase.
5. Allow the workflow to verify, package, stage, activate, and test the release.
6. Confirm the exact live commit and backend health response.
7. Run the live acceptance checklist below.

Do not bypass target-path checks, SSH host verification, staged activation, private-storage checks, or rollback controls.

## Live pilot acceptance checklist

### Public shell

- Load `/growlens/` on desktop and mobile
- Confirm navigation and dialogs fit the viewport
- Install the PWA where supported
- Reload the cached shell offline
- Confirm the service worker does not control WordPress or game routes

### Local-first records

- Create a grow space, cycle, plant, diary entry, task, and reading
- Refresh and confirm persistence
- Capture two observation photos
- Open photo history and compare the images
- Create a complete backup
- Clear local data and restore the complete backup
- Confirm records and photo blobs return

### Account boundary

- Register two disposable test accounts
- Confirm each account sees only its own records and images
- Exercise keep-device, keep-account, and merge conflict choices
- Confirm stale revisions are rejected
- Confirm CSRF and origin protections reject invalid writes
- Export one account
- Delete one disposable account and verify its private images are removed
- Clean up all remaining disposable records and images

### Operations

- Confirm private storage is outside `public_html`
- Confirm scheduled private snapshots complete
- Download and audit a backup artifact
- Perform and document a restore drill using a non-production copy
- Confirm rollback can restore the previous live release

## Remaining product work

### Highest priority

- Production deployment and live pilot acceptance
- Real-device validation for camera capture, IndexedDB durability, PWA installation, and light-estimation calibration
- Structured irrigation, feeding, runoff, EC/pH, harvest, and yield records
- Observation outcome tracking so users can record what was verified and what resolved the issue

### Next priority

- Conflict-safe background synchronization with no silent overwrites
- Better comparison workflows: matched-angle guidance, annotations, and multi-date progress sets
- More useful grow summaries by plant, cycle, cultivar, and environment
- Closed-app reminders only through a privacy-reviewed, low-cost implementation

### Later native layer

- Native camera controls and device-specific light-meter calibration
- Deeper sensor access where supported
- App-store packaging after the web/PWA product proves stable

## Accuracy rules

- Never label a phone-camera estimate as a calibrated quantum-sensor reading.
- Never label a diagnostic possibility as a confirmed deficiency, disease, or pest.
- Always show conflicting evidence and verification steps where available.
- Store measurement units with values and validate ranges before saving.
- Preserve original timestamps and record update timestamps during synchronization.
- Never silently overwrite a different device or server revision.
- Never cache authenticated API responses or private images in the service worker.
