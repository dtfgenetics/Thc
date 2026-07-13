# GrowLens Hostinger Account, Sync, and Private Media Backend

## Purpose

This backend adds optional GrowLens accounts, cross-device JSON synchronization, and authenticated private observation photos without adding a new monthly service. It uses PHP and private file storage on the existing Hostinger plan.

The backend remains separate from the local-first browser stores. GrowLens works without an account, and a failed network or upload request must not erase local records or local photo blobs.

## Deployment layout

Build GrowLens from the repository root:

```bash
npm ci
npm run verify:growlens
```

Upload the complete build artifact:

```txt
apps/growlens-web/dist/
```

to:

```txt
/public_html/growlens/
```

The deployed API will be located at:

```txt
https://dtfseeds.com/growlens/api/
```

Do not upload only the JavaScript assets. The complete `api` directory and its hidden `.htaccess` file are required.

## Required Hostinger configuration

### PHP version

Use PHP 8.1 or newer with the standard `fileinfo` extension enabled. The image upload routes also use `getimagesize()`.

### Private data directory

Create a directory outside `public_html`, for example:

```txt
/home/<hostinger-account>/growlens-private
```

Set the environment value:

```txt
GROWLENS_DATA_DIR=/home/<hostinger-account>/growlens-private
```

The API refuses to use a resolved storage path inside the public document root.

The PHP process must be able to create and update files in this directory. Recommended permissions are owner-only where the hosting environment supports them:

```txt
directories: 0700
files:       0600
```

Do not expose this directory through a subdomain, symlink, file manager share, backup download URL, or web alias.

Private storage contains separate directories for accounts, sessions, JSON state, rate-limit records, and images. Each account's image files and metadata remain inside its own user-ID directory.

### PHP upload limits

The application accepts processed uploads up to 6 MB. Hostinger/PHP limits must not be lower than the application boundary. Review:

```ini
upload_max_filesize = 6M or greater
post_max_size = 7M or greater
max_file_uploads = 10 or greater
```

Do not raise application limits without reviewing disk capacity, denial-of-service controls, backup duration, and image processing behavior.

### Cookie path

For the proposed deployment path, set:

```txt
GROWLENS_COOKIE_PATH=/growlens/
```

The session cookie is HttpOnly and SameSite=Strict. It is marked Secure when PHP detects HTTPS. Production must use HTTPS.

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `api/health.php` | Verify API version and private-storage write access |
| POST | `api/register.php` | Create an account and initial session |
| POST | `api/login.php` | Authenticate and create a session |
| GET | `api/session.php` | Return current authentication and revision metadata |
| GET | `api/sync.php` | Download the authenticated user's current JSON state |
| POST | `api/sync.php` | Save JSON state using an expected revision |
| GET | `api/export.php` | Download the account's current JSON data export |
| POST | `api/logout.php` | Revoke the current session |
| POST | `api/delete-account.php` | Verify password and delete account records, sessions, and images |
| POST | `api/upload-image.php` | Validate and store one private observation image |
| GET | `api/list-images.php` | List the authenticated user's private image metadata |
| GET | `api/image.php?id=<photo-id>` | Stream one authenticated private image |
| POST | `api/delete-image.php` | Delete one authenticated private image and metadata record |

## Authentication model

- Passwords are stored with PHP `password_hash()` using `PASSWORD_DEFAULT`.
- Login uses `password_verify()` and automatically rehashes old hashes when PHP recommends it.
- The browser receives an opaque session cookie; the raw token is never stored in account JSON.
- Session files are addressed by a SHA-256 digest of the raw token.
- Mutating requests require an `X-CSRF-Token` value tied to the current session.
- Login and registration are IP rate-limited.
- JSON writes, photo uploads, photo deletion, and account deletion have additional rate limits.
- Error responses do not expose file paths, hashes, session contents, or other users' media identifiers.

## JSON synchronization and conflicts

Each user snapshot has a monotonically increasing integer `revision`.

A write must include:

```json
{
  "expectedRevision": 4,
  "state": {
    "schemaVersion": 1,
    "spaces": [],
    "cycles": [],
    "plants": [],
    "diary": [],
    "tasks": [],
    "readings": [],
    "calibrationProfiles": [],
    "observations": []
  }
}
```

When the server revision is still `4`, the save succeeds and returns revision `5`.

When another device already advanced the server revision, the API returns HTTP `409` with:

```json
{
  "ok": false,
  "error": "Sync conflict.",
  "conflict": true,
  "revision": 5,
  "updatedAt": "2026-07-13T12:00:00Z"
}
```

The client pulls the current server snapshot and requires the user to keep local data, keep server data, or merge records. It never silently overwrites a conflict.

Photo bytes are not embedded in the JSON state. Observations reference stable `photoIds`, while image blobs are stored and authorized separately. A JSON revision can therefore synchronize an observation before a pending image upload completes; the client must display that image as pending or unavailable rather than treating it as data loss.

## Image validation and privacy

The browser reduces the source image to a maximum 1600-pixel edge and re-encodes it as JPEG, removing original EXIF and other source-file metadata.

The server independently validates every upload:

- upload completed without a PHP upload error;
- byte length is between 1 byte and 6 MB;
- MIME type is detected from file contents with `finfo`;
- detected type is JPEG, PNG, or WebP;
- `getimagesize()` can parse the file;
- width and height are positive;
- longest edge does not exceed 4000 pixels; and
- the destination path is derived from the authenticated user and validated photo ID.

Private image responses include `Cache-Control: private, no-store`. The PWA service worker bypasses every `/api/` request, so authenticated media and account JSON never enter the application-shell cache.

An individual deletion removes both the image bytes and its metadata file. Account deletion removes the entire user image directory while holding the same account-level lock used by synchronization and deletion workflows.

## Backup and recovery

Back up the entire private GrowLens directory independently of the public site build. A static-site redeploy must not remove account data or media.

A complete backup must include:

- `users/`
- `email-index/`
- `sessions/` if session continuity is desired
- `data/`
- `images/`
- rate-limit state only if operationally useful

The current JSON account-export route does not package image bytes. Treat the private image directory as required backup data until a verified media-export archive is implemented.

Before changing the API or media schema:

1. back up the private directory;
2. test migration against a copy;
3. keep a rollback build;
4. verify JSON account export;
5. verify image listing and authenticated streaming;
6. verify two-account record and media isolation;
7. verify account deletion removes images;
8. verify old local-only backups can still import; and
9. perform a restore drill against a separate test directory.

## Deployment verification

After deployment:

1. Visit `https://dtfseeds.com/growlens/api/health.php` and confirm `storageReady` is `true`.
2. Confirm browsing `/growlens/api/` returns a guarded 404 response.
3. Confirm direct access to `/growlens/api/_shared.php` and `/growlens/api/_images.php` is denied by the web server.
4. Register a test account over HTTPS.
5. Log out and log back in.
6. Save a grow record and confirm its revision increments.
7. Attempt a stale JSON write and confirm HTTP `409`.
8. Capture and upload a photo, then confirm it appears only for the authenticated account.
9. Confirm the image response is `private, no-store`.
10. Create a second account and verify it cannot list or stream the first account's records or images.
11. Delete one image and confirm both bytes and metadata disappear.
12. Export the test account JSON data.
13. Delete the test account and confirm its images and old session no longer work.

## Current activation boundary

Manual account synchronization, explicit conflict resolution, offline photo storage, and authenticated private photo upload are implemented and browser-tested. Remaining release work includes packaged image export/import, live two-device isolation tests on Hostinger, backup monitoring and restore drills, richer reports, and production deployment verification.
