# DTFSeeds Hostinger SSH deployment

This is the independent production deployment path for the assembled DTFSeeds public suite.

It exists because `.github/workflows/build-dtfseeds-public-suite.yml` builds and validates a complete release artifact but intentionally does not mutate production. The deploy workflow consumes one successful immutable build artifact and moves only an approved route overlay to Hostinger.

## Workflow

`.github/workflows/deploy-dtfseeds-hostinger-ssh.yml`

The workflow is manual by design. A production run requires the exact confirmation value `DEPLOY`.

Default scope: `games`

- replaces `/games/` from one already-validated public-suite artifact
- includes the direct Bud or Bluff route and its PHP multiplayer endpoints
- creates a server-side backup before replacing the route
- smoke-tests the live Game Hub and Bud or Bluff after activation

Expanded scope: `public-suite`

- deploys the approved release-tree routes used by the public suite: assets, Atlas, blog overlays, games, Learn, Projects, Tools, GrowLens, THC Grow Doc, puzzle data, and the two retained legacy editorial routes when present
- does not deploy arbitrary top-level files from the artifact
- does not replace WordPress core directories such as `wp-admin`, `wp-includes`, or `wp-content`

## Required GitHub Actions secrets

Configure these repository secrets before the first production run:

- `HOSTINGER_SSH_HOST` — the Hostinger SSH/SFTP host or FTP IP shown in hPanel
- `HOSTINGER_SSH_USER` — the FTP/SSH username shown in hPanel
- `HOSTINGER_SSH_PRIVATE_KEY` — private key matching an SSH/SFTP public key installed in Hostinger
- `HOSTINGER_SSH_KNOWN_HOSTS` — pinned `known_hosts` line for the Hostinger SSH host
- `HOSTINGER_PUBLIC_ROOT` — exact absolute website root copied from hPanel, for example `/home/u123456789/domains/dtfseeds.com/public_html`
- `HOSTINGER_SSH_PORT` — optional; when omitted the workflow uses Hostinger Web/Cloud hosting port `65002`

Do not commit credentials, passwords, private keys, or host fingerprints to the repository.

Hostinger documents port `65002` for Web/Cloud SSH/SFTP access and documents the default website root as the domain's `public_html` directory. Always copy the actual host, username, root path, and current host fingerprint from the account instead of guessing them.

## First production run

1. Confirm `Build DTFSeeds Public Suite` has a successful `main` run.
2. Open `Deploy DTFSeeds Suite to Hostinger over SSH` in GitHub Actions.
3. Use scope `games` for the first deployment.
4. Leave `build_run_id` empty to consume the latest successful `main` package, or enter a specific successful build run ID to pin a known artifact.
5. Type `DEPLOY` exactly.
6. The workflow validates the source workflow/run/SHA, downloads the immutable artifact, validates required game files, creates a scoped payload, uploads it over SSH, backs up the existing route, activates the new route, and smoke-tests public URLs.

The first live acceptance target is `/games/bud-or-bluff/`, because the current public route has been observed redirecting to `/games/` while the packaged canonical game exists in this repository.

## Rollback

Every deployment moves the previous route into a timestamped directory under:

`$HOME/.dtf-deploy/backups/`

The normal rollback path is to run the deployment workflow again with the `build_run_id` of the previous known-good public-suite artifact. This provides the same validation, backup, activation, and smoke-test behavior as a forward release.

The server-side backup is an additional recovery copy, not the primary release selector.

## Why SSH instead of a static host

The public suite contains PHP-backed multiplayer/API routes, including Bud or Bluff and Burn Buds. A static-only deployment target would publish the HTML/JS while silently breaking those server endpoints. SSH/SFTP to the existing Hostinger PHP-capable web root preserves the runtime the suite expects.

## Release discipline

- Build and deployment are separate.
- Only consume a successful `Build DTFSeeds Public Suite` run from `main`.
- Never deploy a local unvalidated folder or an arbitrary branch archive.
- Start with `games` until the direct-route smoke tests pass in production.
- Expand to `public-suite` only after the independent path has proven it can deploy, back up, and verify the games overlay safely.
- Treat a failed public smoke test as a failed deployment even when file transport succeeded.
