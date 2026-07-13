# GrowLens Hostinger Account and Sync Backend

## Purpose

This backend adds optional GrowLens accounts and cross-device synchronization without adding a new monthly service. It uses PHP and private JSON storage on the existing Hostinger plan.

The backend is intentionally separate from the local-first browser store. GrowLens remains usable without an account, and a failed network request must not erase local records.

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

Do not upload only the JavaScript assets. The `api` directory and its hidden `.htaccess` file are required.

## Required Hostinger configuration

### PHP version

Use PHP 8.1 or newer.

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
| GET | `api/sync.php` | Download the authenticated user's current state |
| POST | `api/sync.php` | Save state using an expected revision |
| GET | `api/export.php` | Download the account's current data export |
| POST | `api/logout.php` | Revoke the current session |
| POST | `api/delete-account.php` | Verify password and delete account data and sessions |

## Authentication model

- Passwords are stored with PHP `password_hash()` using `PASSWORD_DEFAULT`.
- Login uses `password_verify()` and automatically rehashes old hashes when PHP recommends it.
- The browser receives an opaque session cookie; the raw token is never stored in account JSON.
- Session files are addressed by a SHA-256 digest of the raw token.
- Mutating requests require an `X-CSRF-Token` value tied to the current session.
- Login and registration are IP rate-limited.
- Data writes and account deletion have additional rate limits.
- Error responses do not expose file paths, hashes, or session contents.

## Synchronization and conflicts

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

The client must pull the current server snapshot and ask the user whether to keep local data, keep server data, or merge records. It must never silently overwrite a conflict.

## Backup and recovery

Back up the entire private GrowLens directory independently of the public site build. A static-site redeploy must not remove account data.

Before changing the API schema:

1. back up the private directory;
2. test migration against a copy;
3. keep a rollback build;
4. verify account export;
5. verify two-account isolation;
6. verify old local-only backups can still import.

## Deployment verification

After deployment:

1. Visit `https://dtfseeds.com/growlens/api/health.php` and confirm `storageReady` is `true`.
2. Confirm browsing `/growlens/api/` returns a guarded 404 response.
3. Confirm direct access to `/growlens/api/_shared.php` is denied by the web server.
4. Register a test account over HTTPS.
5. Log out and log back in.
6. Save a grow record and confirm its revision increments.
7. Attempt a stale write and confirm HTTP `409`.
8. Create a second account and verify it cannot read the first account's records.
9. Export the test account data.
10. Delete the test account and confirm its old session no longer authenticates.

## Current activation boundary

The PHP backend and typed browser transport can be deployed and tested independently. The main GrowLens interface should not enable automatic account synchronization until its conflict-resolution and local-data recovery screens are implemented and browser-tested.
