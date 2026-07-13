# GrowLens Hostinger Production Deployment

## What this workflow does

The manual GitHub Actions workflow at `.github/workflows/growlens-deploy-hostinger.yml` builds, tests, packages, uploads, activates, verifies, and—when activation fails—rolls back GrowLens.

It is deliberately separate from normal pull-request CI. A production release can only be started from the `main` branch, with the `deploy` input enabled and the exact confirmation text `DEPLOY-GROWLENS`.

The workflow never writes to the WordPress root. The target secret must resolve to a path ending in:

```txt
/public_html/growlens
```

The private backup directory must be outside `public_html`. The GrowLens account/image data directory must also remain outside `public_html` and is not touched by static deployments.

## Release sequence

1. Require the `main` branch.
2. Install locked npm dependencies.
3. Lint every GrowLens PHP file.
4. Run backend and private-image smoke tests.
5. Run GrowLens unit tests and acceptance-client self-tests.
6. Build the production PWA without publishing JavaScript source maps.
7. Verify all required frontend and PHP API files, including hidden `api/.htaccess`.
8. Run the complete desktop/mobile Playwright suite.
9. Add `deploy.json` containing the exact Git commit and build timestamp.
10. Upload the verified release as a GitHub artifact retained for 30 days.
11. Upload to an isolated sibling staging directory on Hostinger.
12. Verify required files in staging.
13. Move the current public release aside and atomically move staging into place.
14. Verify the exact live commit through `deploy.json`.
15. Verify `api/health.php` returns `ok: true`, `service: growlens-api`, and `storageReady: true`.
16. Confirm direct requests to private API helper files return HTTP 403 or 404.
17. Roll back automatically when activation or live verification fails.
18. Move the previous public release into a private backup directory and keep the five newest release backups.

## Required GitHub environment

Create a GitHub Actions environment named:

```txt
growlens-production
```

Recommended environment protection:

- Require manual approval before deployment or live acceptance can access production secrets.
- Restrict deployments to the `main` branch.
- Do not expose these secrets to pull requests or untrusted branches.

## Required GitHub Actions secrets

Add these as environment secrets under `growlens-production`:

| Secret | Purpose |
| --- | --- |
| `HOSTINGER_SSH_HOST` | Hostinger SSH hostname only; no protocol or command options. |
| `HOSTINGER_SSH_PORT` | SSH port. Leave empty only when port 22 is correct. |
| `HOSTINGER_SSH_USER` | Hostinger SSH username. |
| `HOSTINGER_SSH_PRIVATE_KEY` | Private key dedicated to deployment. Do not reuse a personal key. |
| `HOSTINGER_SSH_KNOWN_HOSTS` | Trusted `known_hosts` entry captured independently from Hostinger. The workflow does not trust first connection automatically. |
| `HOSTINGER_GROWLENS_PATH` | Absolute deployment path ending in `/public_html/growlens`. |
| `HOSTINGER_GROWLENS_BACKUP_DIR` | Absolute private release-backup path outside `public_html`. |
| `GROWLENS_ACCEPTANCE_PASSWORD_SEED` | Stable random seed of at least 32 characters used to derive recoverable disposable live-acceptance passwords without logging them. |

Example path shapes only—use the real paths shown by the Hostinger account:

```txt
HOSTINGER_GROWLENS_PATH=/home/account/domains/dtfseeds.com/public_html/growlens
HOSTINGER_GROWLENS_BACKUP_DIR=/home/account/growlens-release-backups
```

The workflow rejects paths containing parent-directory traversal, spaces, shell metacharacters, a target outside `/public_html/growlens`, or a backup directory inside `public_html`.

## Required Hostinger preparation

Before the first live release:

1. Enable SSH access for the hosting account.
2. Add the deployment public key to the account's authorized SSH keys.
3. Confirm the SSH user can run `rsync`, `mv`, `find`, and standard POSIX shell commands.
4. Confirm the SSH user can write to the parent of the GrowLens target and the private release-backup directory.
5. Create the separate private GrowLens application-data directory described in `docs/GROWLENS_HOSTINGER_BACKEND.md`.
6. Set `GROWLENS_DATA_DIR` to that private directory through the hosting environment.
7. Set `GROWLENS_COOKIE_PATH=/growlens/`.
8. Confirm PHP 8.1 or newer, `fileinfo`, and `getimagesize()` support.
9. Confirm HTTPS is active for `dtfseeds.com`.
10. Keep WordPress files and the site root outside the deployment target.

## First safe run

Run the deployment workflow once with:

```txt
deploy: false
```

This performs the complete verification and creates the exact production artifact without opening an SSH connection or changing Hostinger.

After the environment and secrets are configured, run again from `main` with:

```txt
deploy: true
confirmation: DEPLOY-GROWLENS
```

The deployment is successful only when the live commit marker, private-storage health endpoint, and private-helper denial checks pass.

## Post-deployment acceptance checks

After deployment, run the separate **GrowLens Live Acceptance** workflow from `main` with:

```txt
base_url: https://dtfseeds.com/growlens
confirmation: RUN-DESTRUCTIVE-ACCEPTANCE
test_email_domain: example.com
```

The protected workflow automates:

1. Registration of disposable accounts A and B.
2. Account A record synchronization from device one.
3. Account A login from a second independent session.
4. Revision advancement and stale-write HTTP 409 protection.
5. Account B record and image isolation.
6. Private image upload, listing, streaming, cache-header checks, and deletion.
7. Account export and authentication-secret exclusion.
8. Account deletion, session revocation, credential rejection, and cleanup.

Detailed behavior, rate-limit guidance, and orphaned-run recovery are documented in `docs/GROWLENS_LIVE_ACCEPTANCE.md`.

A separate restored-copy disaster-recovery test of the private data directory is still required. Do not call the backend production-ready until both the automated live acceptance suite and a private-data restore test pass.

## Rollback boundary

If the new live commit marker or API health check fails, the workflow removes the failed target and restores the previous public release directory.

Static release rollback does not restore private GrowLens account or image data. Private data must use its own backup and restore process. Never place the private data directory inside the deploy target or release-backup directory.
