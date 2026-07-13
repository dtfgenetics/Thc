# GrowLens Release Plan

## Current release candidate: local-first foundation

The first release candidate is a useful offline-capable application, not a fake account system. It deliberately keeps user records in browser storage until the server-side privacy boundary is implemented and tested.

## Build artifact

```txt
apps/growlens-web/dist
```

## Proposed live path

```txt
https://dtfseeds.com/growlens/
```

## Required pre-release checks

1. `npm run test:growlens`
2. `npm run build:growlens`
3. `npm run test:e2e:growlens`
4. Confirm the final build contains `index.html`, `manifest.webmanifest`, `sw.js`, and `icon.svg`.
5. Test desktop and mobile navigation.
6. Create a grow space, cycle, plant, diary entry, task, reading, and observation.
7. Refresh and confirm data remains.
8. Export a backup, clear local data, import the backup, and confirm recovery.
9. Install the PWA and test one offline reload after the app shell has been cached.
10. Confirm the deployed service worker does not control unrelated WordPress or game routes.

## Hostinger account and sync gate

Server synchronization is a separate release because it introduces private user data. It is not complete until all of the following are implemented and tested:

- Registration and login
- Password hashing with PHP `password_hash` and `password_verify`
- Secure, expiring, revocable sessions
- Same-site secure cookies or an equivalent reviewed token boundary
- Per-user authorization on every record and image operation
- CSRF protection for cookie-authenticated writes
- Request-size, content-type, and rate limits
- Private data directory outside the public document root
- Atomic writes and backups
- Record revision numbers or timestamps for conflict handling
- Account export and deletion
- Private image validation and metadata handling
- Automated tests proving one account cannot read or modify another account

## Product gates after sync

- Light-meter calibration wizard by device and fixture
- Repeated canopy-map sessions with trend comparison
- Photo compression and private storage
- Observation outcome tracking to improve rule quality
- Searchable environment and irrigation history
- Printable grow, plant, light, and observation reports
- Optional notifications using browser-native capabilities before adding paid services

## Accuracy rules

- Never label a phone-camera estimate as a calibrated quantum sensor reading.
- Never label a diagnostic possibility as a confirmed deficiency, disease, or pest.
- Always show conflicting evidence and verification steps where available.
- Store measurement units with values and validate ranges before saving.
- Preserve original timestamps and record update timestamps once synchronization is active.
