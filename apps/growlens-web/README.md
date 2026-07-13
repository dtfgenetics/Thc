# THC GrowLens

GrowLens is a mobile-first, local-first cultivation management PWA. It is intentionally isolated from the High Land game under `apps/growlens-web`.

## Included in this foundation

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
- PWA manifest, service worker, and offline shell
- Unit tests and Playwright browser smoke tests

## Important limitations

- Records currently live in the browser that created them.
- Account authentication and Hostinger synchronization are not active yet.
- Observation photos are previewed in memory but are not stored in this release.
- Lux-to-PPFD and phone-camera readings are estimates that require fixture/device-specific calibration.
- Diagnostic results are possible causes, not confirmed diagnoses.

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

Development URL:

```txt
http://localhost:5174
```

Production output:

```txt
apps/growlens-web/dist
```

## Data model

The root record is `GrowLensState` with `schemaVersion: 1`. Records are stored under:

```txt
thc-growlens-state-v1
```

The schema separates spaces, cycles, plants, diary entries, tasks, environment readings, calibration profiles, and observations so a later backend can synchronize individual record types without rewriting the UI.

## Deployment target

Deploy the contents of `apps/growlens-web/dist` to a dedicated path such as:

```txt
https://dtfseeds.com/growlens/
```

The Vite build uses relative asset paths so the app can run below a subdirectory. Verify service-worker scope and cache behavior on the final URL before calling the deployment complete.

## Security boundary for the next phase

Do not activate multi-user sync until the Hostinger persistence layer has:

- Password hashing and secure session handling
- User-level record authorization on every request
- CSRF and origin controls for browser writes
- Rate limiting and abuse controls
- Private file storage outside public browsing
- File type, size, and content validation
- Export and account deletion endpoints
- Backup, migration, and rollback procedures
- Two-account isolation tests

Never put server secrets or storage paths into browser code.
