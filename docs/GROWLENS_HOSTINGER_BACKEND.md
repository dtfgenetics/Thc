# GrowLens Hostinger Account, Sync, and Private Media Backend

## Purpose

This backend provides optional GrowLens accounts, cross-device JSON synchronization, and authenticated private observation photos on the existing Hostinger plan. It does not add a new monthly service.

The backend remains separate from the local-first browser stores. GrowLens works without an account, and failed network, sync, or upload requests must never erase local records or local photo blobs.

## Deployment layout

Build from the repository root:

```bash
npm ci
npm run verify:growlens
php apps/growlens-web/tests/php-state-v2-smoke.php
```

Upload the complete contents of:

```txt
apps/growlens-web/dist/
```

to:

```txt
/public_html/growlens/
```

The API is deployed under:

```txt
https://dtfseeds.com/growlens/api/
```

Do not upload only JavaScript assets. The full `api` directory and hidden `.htaccess` are required. `_shared.php`, `_state-v2.php`, and `_images.php` are private helper files and must be denied from direct browsing.

## Required Hostinger configuration

### PHP

Use PHP 8.1 or newer with `fileinfo`; image routes also use `getimagesize()`.

### Private data directory

Create a directory outside `public_html`, for example:

```txt
/home/<hostinger-account>/growlens-private
```

Configure:

```txt
GROWLENS_DATA_DIR=/home/<hostinger-account>/growlens-private
GROWLENS_COOKIE_PATH=/growlens/
```

The API refuses to use a resolved storage path inside the public document root. Recommended permissions, where supported:

```txt
directories: 0700
files:       0600
```

Do not expose this directory through a subdomain, symlink, public backup URL, file-manager share, or web alias.

Private storage contains separate account, session, state, rate-limit, and image areas. Images and metadata remain inside per-user directories.

### Upload limits

Processed image uploads are limited to 6 MB. Hostinger/PHP limits must not be lower than the application boundary:

```ini
upload_max_filesize = 6M or greater
post_max_size = 7M or greater
max_file_uploads = 10 or greater
```

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `api/health.php` | Verify API and private-storage write access |
| POST | `api/register.php` | Create an account and schema-v2 state |
| POST | `api/login.php` | Authenticate and return schema-v2 state |
| GET | `api/session.php` | Return authentication and revision metadata |
| GET | `api/sync.php` | Download the authenticated schema-v2 snapshot |
| POST | `api/sync.php` | Save schema-v2 state using an expected revision |
| GET | `api/export.php` | Download account JSON including structured records |
| POST | `api/logout.php` | Revoke the current session |
| POST | `api/delete-account.php` | Delete account records, sessions, and images |
| POST | `api/upload-image.php` | Validate and store one private image |
| GET | `api/list-images.php` | List authenticated image metadata |
| GET | `api/image.php?id=<photo-id>` | Stream one authenticated private image |
| POST | `api/delete-image.php` | Delete one authenticated image and metadata |

## Authentication and authorization

- Passwords use `password_hash()` with `PASSWORD_DEFAULT`.
- Login uses `password_verify()` and rehashes when recommended.
- The browser receives an opaque HttpOnly, SameSite=Strict session cookie.
- Raw session tokens are not stored in account JSON.
- Session files are addressed by a SHA-256 digest of the raw token.
- Mutating requests require a session-bound `X-CSRF-Token`.
- Login, registration, sync writes, uploads, deletion, and account deletion are rate-limited.
- Errors do not expose paths, hashes, sessions, or another user’s media identifiers.

## Schema version 2

`_state-v2.php` is the account-state adapter used by registration, login, session metadata, sync, and export.

It accepts schema-version 1 snapshots and normalizes them to schema version 2 on read. Existing collections remain intact and the following collections are initialized when absent:

```txt
irrigationRecords
feedingRecords
reservoirRecords
harvestRecords
observationOutcomes
```

A schema-version 2 write has this shape:

```json
{
  "expectedRevision": 4,
  "state": {
    "schemaVersion": 2,
    "spaces": [],
    "cycles": [],
    "plants": [],
    "diary": [],
    "tasks": [],
    "readings": [],
    "calibrationProfiles": [],
    "observations": [],
    "irrigationRecords": [],
    "feedingRecords": [],
    "reservoirRecords": [],
    "harvestRecords": [],
    "observationOutcomes": []
  }
}
```

The adapter validates collection type and size, record shape, total encoded state size, and revision conflicts. Browser-side normalization performs field-level range and unit validation before saving.

Do not remove `_state-v2.php` or route account endpoints back through the schema-version 1 helper functions; doing so would silently discard structured records.

## Synchronization and conflicts

Each user snapshot has a monotonically increasing integer revision.

A save succeeds only when `expectedRevision` equals the current server revision. A stale write returns HTTP `409` with the current revision and update timestamp. The browser then requires an explicit keep-device, keep-account, or merge decision. No background or manual path may silently overwrite a different revision.

All collections, including structured cultivation records, merge by stable record ID. When the same ID differs, the current-device record wins during the explicit manual merge.

Photo bytes are not embedded in JSON. Observations and harvests may reference stable photo IDs; image blobs are stored and authorized separately.

## Structured-record units

The browser stores explicit units:

- water/runoff: milliliters
- reservoir volume: liters
- EC: mS/cm
- pH: 0–14
- moisture, humidity, dryback, runoff: percentage
- temperature: Celsius
- harvest/yield: grams
- PPM: value plus 500 or 700 conversion scale

Runoff percentage and wet-to-dry loss are derived from saved measurements.

## Image validation and privacy

The browser resizes and re-encodes source images, removing original metadata. The server independently validates upload completion, byte length, MIME signature, dimensions, accepted type, destination ID, and authenticated user directory.

Private image responses use `Cache-Control: private, no-store`. The PWA service worker bypasses every `/api/` request.

Individual deletion removes bytes and metadata. Account deletion removes the entire user image directory while using the account-level lock shared with synchronization.

## Backup and recovery

Back up the entire private GrowLens directory independently of the public release. A static redeploy must not remove private records or media.

A full server backup includes:

```txt
users/
email-index/
sessions/       optional if session continuity is desired
data/
images/
```

Complete local `.growlens.json` archives include local JSON records and local IndexedDB photo blobs. Account JSON export includes structured records but does not package private server-only image bytes.

Before changing schema or media handling:

1. back up the private directory;
2. run `php-state-v2-smoke.php`;
3. test migration against a copy;
4. verify account export;
5. verify complete local backup restore;
6. verify image listing and authenticated streaming;
7. verify two-account record and media isolation;
8. verify account deletion removes images; and
9. perform a restore drill against a separate test directory.

## Deployment verification

After deployment:

1. Confirm `api/health.php` returns `storageReady: true`.
2. Confirm browsing `/growlens/api/` is denied or guarded.
3. Confirm direct access to `_shared.php`, `_state-v2.php`, and `_images.php` returns 403 or 404.
4. Register and log in over HTTPS.
5. Save schema-version 2 irrigation, feeding, reservoir, harvest, and outcome records.
6. Confirm the revision increments and all collections return after login and pull.
7. Attempt a stale write and confirm HTTP `409`.
8. Upload an image and confirm authenticated, `private, no-store` streaming.
9. Create a second account and verify it cannot access the first account’s records or images.
10. Export account JSON and verify all structured collections are present.
11. Delete the disposable accounts and verify records, sessions, and images are removed.

## Current activation boundary

Manual account synchronization, explicit conflict resolution, schema-version 2 structured records, local/private photos, complete local backups, private-data backup tooling, and guarded Hostinger deployment are implemented and automated-test covered. Remaining release work is live deployment, two-account/two-device acceptance, backup restore drills, real-device camera/light validation, and conflict-safe background synchronization.
