# GrowLens Live Acceptance Test

## Purpose

The live acceptance suite verifies the deployed GrowLens PHP backend from outside the server. It creates two disposable accounts, exercises independent sessions and private data, then deletes the accounts.

This is deliberately separate from unit tests and local browser tests. It answers production-only questions such as:

- Is the deployed API reachable over HTTPS?
- Is private storage writable?
- Are session cookies and CSRF checks working on the real domain?
- Can a second device load and update the same account?
- Does revision conflict protection reject stale writes?
- Can one account see or change another account's records or images?
- Are private images streamed with non-public cache headers?
- Does account export exclude authentication secrets?
- Are account sessions revoked after deletion?

## Destructive boundary

The suite creates and deletes disposable test accounts and private images. It must not be pointed at a route other than a deliberate GrowLens deployment.

The client enforces all of these controls:

- Exact confirmation: `RUN-DESTRUCTIVE-ACCEPTANCE`
- HTTPS, except explicitly enabled localhost testing
- Absolute URL ending in `/growlens`
- Two unique disposable account addresses per run
- A protected password-recovery seed of at least 32 characters
- Automatic cleanup in a `finally` block
- Best-effort cleanup through either existing session, followed by a fresh login
- No passwords, CSRF tokens, or session cookies printed in normal logs

The GitHub workflow adds:

- `main` branch requirement
- Protected `growlens-production` environment
- Non-overlapping concurrency
- Manual dispatch only
- Retained test logs

## Required GitHub environment secret

Add this secret to the existing `growlens-production` environment:

```txt
GROWLENS_ACCEPTANCE_PASSWORD_SEED
```

Use a randomly generated value of at least 32 characters. Keep it stable so an authorized operator can reconstruct credentials for an orphaned run. Do not rotate it until all disposable accounts from earlier runs are confirmed deleted.

A suitable seed can be generated locally with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Do not paste the seed into issues, pull requests, logs, or chat.

## Protected GitHub run

After GrowLens is deployed and its health endpoint passes:

1. Open **Actions** in GitHub.
2. Select **GrowLens Live Acceptance**.
3. Choose **Run workflow** on `main`.
4. Keep the target URL ending in `/growlens`.
5. Enter `RUN-DESTRUCTIVE-ACCEPTANCE` as the confirmation.
6. Keep `example.com` as the disposable email domain unless a different reserved test domain is intentionally configured.
7. Approve the protected `growlens-production` environment when prompted.

The workflow runs:

```bash
npm run test:growlens:live-client
npm run test:live:growlens
```

## Exact live scenario

1. Check `api/health.php` and private-storage readiness.
2. Confirm anonymous sync access returns HTTP 401.
3. Confirm a foreign `Origin` is rejected with HTTP 403.
4. Register disposable accounts A and B.
5. Confirm both accounts start with independent IDs, sessions, CSRF tokens, and empty state.
6. Confirm account A's session persists.
7. Confirm a write without account A's CSRF token fails and does not change its revision.
8. Save a complete disposable GrowLens state from account A, device one.
9. Log in to account A from a second independent cookie jar.
10. Confirm device two receives revision 1 and the saved records.
11. Save a second-device update as revision 2.
12. Attempt a stale revision-1 write from device one and require HTTP 409.
13. Pull revision 2 from device one and confirm the newer record survived.
14. Confirm account B remains at revision 0 with empty state.
15. Upload a valid private PNG from account A, device one.
16. List and stream the image from account A, device two.
17. Confirm private, no-store, and `nosniff` headers on the image response.
18. Confirm account B cannot list, stream, or delete account A's image.
19. Confirm anonymous image access returns HTTP 401.
20. Export account A and confirm revision 2, current records, attachment headers, and no password/session/CSRF material.
21. Delete the first image and confirm deletion across both account-A sessions.
22. Upload a second image so account deletion is tested with private image data present.
23. Delete account A.
24. Confirm both account-A sessions become unauthenticated and the old credentials no longer log in.
25. Confirm account B remains isolated and unchanged.
26. Delete account B and confirm its session is cleared.
27. Run cleanup again in `finally` if any earlier assertion failed.

## Registration-rate limit

The production registration endpoint allows five registrations per source IP per hour. A normal acceptance run creates two accounts. Avoid repeatedly restarting the suite in quick succession; an interrupted run plus several retries can legitimately hit the rate limit.

Wait for the rate window to reset rather than weakening production controls.

## Orphaned-run recovery

The acceptance log prints the run ID and the two disposable email addresses but never prints passwords. If a runner is terminated before cleanup, an authorized operator who has the protected password seed can reconstruct the credentials locally.

Set the same email domain used by the run, then execute:

```bash
export GROWLENS_ACCEPTANCE_PASSWORD_SEED='read-from-your-secure-secret-store'
export GROWLENS_TEST_EMAIL_DOMAIN='example.com'
export GROWLENS_RECOVERY_CONFIRM='PRINT-RECOVERY-CREDENTIALS'
npm run recover:growlens:acceptance -- 20260713203000-abc123
```

Run that only on a trusted local machine. It intentionally prints the disposable passwords. Use the credentials to log in and delete any orphaned accounts, then clear the shell environment and terminal history as appropriate.

## What this does not prove

The external suite cannot inspect the Hostinger filesystem directly. It verifies externally observable deletion and isolation behavior, while the local PHP smoke tests inspect private storage and image deletion internally.

It also does not replace:

- A restored-copy disaster-recovery test of the private data directory
- Long-duration load and concurrency testing
- Browser-specific camera and notification permission testing on physical devices
- Legal/privacy review of production terms and retention policies
- Monitoring and alerting after launch

Production readiness requires both the automated live suite and a separately documented restore test.
