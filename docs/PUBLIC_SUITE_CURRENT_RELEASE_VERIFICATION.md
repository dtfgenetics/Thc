# Current Public Suite release verification

The Public Suite build proves that deployable files are correct. Production verification must separately prove that dtfseeds.com is serving the current release rather than a stale route, redirect, or older static copy.

`scripts/verify-live-public-suite-current-releases.mjs` covers ready public games that were not previously fingerprinted by the main deployment workflow. It intentionally disables redirects and verifies route-specific release markers. High Land additionally verifies its V2 CSS design-token fingerprint, while Seed Man verifies the exact current release marker and expanded 24-sprout/7,800 px course.

The `Verify Current DTFSeeds Public Suite Releases` workflow runs the script automatically after a successful Public Suite V2 deployment and can also be dispatched manually.

Keep this verifier focused on current-release fingerprints. Generic availability checks belong in the broader feature-surface verification workflow.
