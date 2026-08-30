# DTFSeeds Hostinger SSH deployment

This is the independent production deployment path for the assembled DTFSeeds public suite.

The build workflow already creates and validates an immutable public-suite artifact. This deployment workflow consumes only one successful artifact from `main`, creates a scoped overlay, transfers it to Hostinger over SSH, activates it with rollback protection, and verifies the public routes.

## Files

- `.github/workflows/deploy-dtfseeds-hostinger-ssh.yml`
- `scripts/deploy/hostinger-overlay.sh`
- `scripts/deploy/test-hostinger-overlay.sh`

The activation script is deliberately separate from the workflow YAML so its filesystem behavior can be tested without production credentials.

## Safety model

A production run is manual and requires the exact confirmation value `DEPLOY`.

Before any production mutation the workflow verifies:

1. the selected run belongs to `.github/workflows/build-dtfseeds-public-suite.yml`
2. the run completed successfully on `main`
3. the exact non-expired artifact `dtfseeds-public-suite-<SHA>` exists once
4. `dtf-build.json` identifies the same source SHA
5. the Game Hub and Bud or Bluff route/API files are present
6. every required Hostinger secret is configured
7. the configured public root is an absolute path ending in `/public_html`

The deployer refuses `/`, arbitrary directories, incomplete packages, unsupported scopes, invalid SHAs, and unsafe rollback identifiers.

## Default scope: `games`

The first production proof replaces only the validated game overlay plus `dtf-build.json`.

It includes the direct Bud or Bluff route and the PHP multiplayer endpoint. This is the safest first target because the public Bud or Bluff link has been observed redirecting back to the Game Hub even though the canonical game exists in the production package.

## Expanded scope: `public-suite`

After the games deployment proves the transport and rollback path, `public-suite` can deploy the approved route set:

- assets
- Atlas and blog overlays when present
- games
- Learn
- Projects
- Tools
- GrowLens
- THC Grow Doc
- puzzle data
- the retained legacy editorial routes when present
- `dtf-build.json`

It never replaces WordPress core directories such as `wp-admin`, `wp-includes`, or `wp-content`.

## Required GitHub Actions secrets

Configure these repository secrets:

- `HOSTINGER_SSH_HOST`
- `HOSTINGER_SSH_USER`
- `HOSTINGER_SSH_PRIVATE_KEY`
- `HOSTINGER_SSH_KNOWN_HOSTS`
- `HOSTINGER_PUBLIC_ROOT`
- `HOSTINGER_SSH_PORT` (optional; defaults to `65002`)

Use the exact values from Hostinger hPanel. Do not commit passwords, private keys, or host fingerprints.

The SSH private key should be a dedicated deployment key that GitHub Actions can use non-interactively.

## Activation and rollback

The uploaded archive is extracted into a hidden staging directory next to `public_html`, so route moves and backups stay on the same hosting filesystem.

Before replacing anything, the deployer:

- validates the staged files
- records every route it will touch in a manifest
- records whether a previous version existed
- backs up the prior deployment metadata

During activation, any filesystem or validation error triggers an immediate in-script restoration from that manifest.

After activation, GitHub verifies:

- the Game Hub is reachable and contains the expected catalog marker
- `/games/bud-or-bluff/` remains the effective route instead of redirecting to `/games/`
- the page contains Bud or Bluff content
- the live `dtf-build.json` identifies the deployed SHA
- additional core routes respond when `public-suite` is selected

If any public smoke test fails after activation, the workflow automatically invokes the rollback action and restores the previous route set.

Backups live outside the public web root under the domain directory:

`<domain-directory>/.dtf-backups/<backup-id>/`

A failed new release is preserved inside its backup directory during rollback for diagnosis.

## Local/CI test

`bash scripts/deploy/test-hostinger-overlay.sh`

The test uses a temporary fake `public_html` and proves:

- a complete game package activates
- the previous route is backed up
- rollback restores the previous files and deployment metadata
- an incomplete package is rejected before production mutation
- an unsafe public-root path is rejected

The PR validation workflow runs this test automatically whenever the deploy workflow, script, test, or documentation changes.

## First production run

1. Merge only after the deployment validation and the repository release-hardening checks pass.
2. Configure the Hostinger Actions secrets.
3. Confirm `Build DTFSeeds Public Suite` has a successful `main` run.
4. Open `Deploy DTFSeeds Suite to Hostinger over SSH`.
5. Select `games`.
6. Leave `build_run_id` blank for the newest successful `main` package, or enter a known-good build run ID.
7. Type `DEPLOY`.
8. Require the workflow to finish successfully, including public smoke tests.
9. Verify Bud or Bluff and several additional game routes from a normal browser.
10. Only then promote later runs to `public-suite`.

## Release discipline

- Build and deployment remain separate.
- Never deploy a local folder or arbitrary branch archive.
- Deploy only a successful immutable public-suite artifact from `main`.
- Keep active feature branches separate from frozen production candidates.
- Treat transport success as insufficient; public smoke tests decide whether a release stays active.
- A failed smoke test must leave production on the previous known route set.
