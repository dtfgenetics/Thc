# GrowLens Release Plan

## Current release candidate

GrowLens is a functional local-first PWA with an optional Hostinger account layer. The current release candidate includes core grow management, structured cultivation records, offline/private photos, complete backups, reports, routines, revision-aware synchronization, and guarded deployment.

The controlled production pilot target is:

```txt
https://dtfseeds.com/growlens/
```

Product claims must remain accurate:

- GrowLens is a cultivation management and observation tool.
- Diagnostic rules provide possible causes, not confirmed diagnoses.
- Light calculations and phone-derived estimates are not quantum-sensor measurements.
- Account sync is optional and user-controlled.
- Closed-app push notifications and automatic background sync are not active.

## Implemented release scope

### Grow management

- Grow spaces, cycles, plants, stages, and statuses
- Searchable diary
- One-time and recurring tasks
- Environment readings
- Unified plant history and reports
- CSV and printable exports

### Structured cultivation records

- Irrigation source, applied volume, runoff volume and percentage
- Input and runoff pH and EC
- Substrate moisture, dryback, and irrigation duration
- Feeding source water, starting/final EC, final pH, PPM and scale
- Itemized nutrient products, additives, and mixing notes
- Reservoir identity, capacity, current volume, pH, EC, temperature, and mix time
- Harvest lot, wet/dry/trimmed/waste weights, drying conditions, cure checkpoints, and final photo IDs
- Observation outcomes: monitoring, confirmed, ruled out, and resolved
- Historical edit/delete controls
- Schema-version 1 to schema-version 2 migration

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
- Schema-v2 Hostinger adapter preserving structured records during login, pull, push, export, and registration

### Delivery safeguards

- PWA manifest and offline shell
- Service-worker exclusion for all API traffic
- PHP linting and backend smoke tests
- Dedicated schema-v2 migration/persistence smoke test
- Unit tests
- Desktop and mobile Playwright tests
- Protected destructive live-acceptance tooling
- Main-only guarded Hostinger deployment with staged activation and rollback

## Build artifact

```txt
apps/growlens-web/dist
```

The production package must contain the application shell, manifest, service worker, icon, PHP API, shared security helpers, schema-v2 adapter, image endpoints, and API `.htaccess` file.

## Standard verification

Run from the repository root:

```bash
npm ci
npm run verify:growlens
php apps/growlens-web/tests/php-backend-smoke.php
php apps/growlens-web/tests/php-state-v2-smoke.php
php apps/growlens-web/tests/php-image-storage-smoke.php
php apps/growlens-web/tests/php-private-data-tools-smoke.php
```

Verification is incomplete unless all of the following pass:

1. TypeScript compilation and production build
2. Unit tests
3. PHP syntax checks
4. Account/backend smoke tests
5. Schema-v1 to schema-v2 migration and round-trip persistence
6. Private-image storage smoke tests
7. Complete-backup and restore tests
8. Desktop browser tests
9. Mobile browser tests
10. Required production-file checks

## Controlled production release

Production deployment is intentionally not automatic after every merge.

1. Merge only a green GrowLens pull request into `main`.
2. Review the exact production commit.
3. Run the `Deploy GrowLens to Hostinger` workflow from `main`.
4. Enable deployment and enter the required confirmation phrase.
5. Allow the workflow to verify, package, stage, activate, and test the release.
6. Confirm the exact live commit and backend health response.
7. Confirm `_shared.php`, `_state-v2.php`, and `_images.php` are denied from direct browsing.
8. Run the live acceptance checklist.

Do not bypass target-path checks, SSH host verification, staged activation, private-storage checks, schema checks, or rollback controls.

## Live pilot acceptance checklist

### Public shell

- Load `/growlens/` on desktop and mobile
- Confirm navigation and dialogs fit the viewport
- Install the PWA where supported
- Reload the cached shell offline
- Confirm the service worker does not control WordPress or game routes

### Local-first records

- Create a grow space, cycle, and plant
- Add diary, task, and environment records
- Add irrigation, feeding, reservoir, harvest, and observation-outcome records
- Refresh and confirm schema-version 2 persistence
- Capture two observation photos
- Open photo history and compare the images
- Create a complete backup
- Clear local data and restore the complete backup
- Confirm all structured records and photo blobs return

### Account boundary

- Register two disposable accounts
- Confirm each account sees only its own records and images
- Push and pull all schema-version 2 collections
- Exercise keep-device, keep-account, and merge choices
- Confirm stale revisions are rejected
- Confirm CSRF and origin protections reject invalid writes
- Export one account and verify structured records are present
- Delete one disposable account and verify its private images are removed
- Clean up all disposable records and images

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
- Better analytics by plant, cycle, cultivar, environment, irrigation, and yield

### Next priority

- Conflict-safe background synchronization with no silent overwrites
- Better comparison workflows: matched-angle guidance, annotations, and multi-date progress sets
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
- Always store the PPM conversion scale when recording PPM.
- Preserve original timestamps and update timestamps during synchronization.
- Never silently overwrite a different device or server revision.
- Never cache authenticated API responses or private images in the service worker.
