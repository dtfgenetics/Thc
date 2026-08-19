# DTFSeeds production-source repair — 2026-08-18

This record captures source-control repairs completed while live static deployment remains blocked on Hostinger SSH credentials.

## Corrected

- High IQ is now consistently represented as a self-hosted static browser game rather than an external-only Base44 runtime.
- High IQ canonical data and deployable public data are validated byte-for-byte before release packaging.
- Public project status now lists High IQ among buildable browser applications.
- The deployment manifest marks High IQ as `static` and `ready-to-package`.
- The portfolio registry marks High IQ `canonical` in GitHub while retaining Drive ownership of approved print/release masters.
- Portfolio validation no longer invents or requires Drive paths for legitimate GitHub-first projects.
- Portfolio CI now validates High IQ runtime, metadata, and source-of-truth consistency.
- The temporary WordPress reconciliation trigger file was removed after use.
- The complete static public suite now builds and validates successfully as an immutable GitHub Actions artifact.
- The static production watchdog was restored to its proven one-job configuration.
- Canonical WordPress REST reconciliation was isolated into its own production workflow with an unrestricted `main` push trigger, rollback artifacts, front-page enforcement, and live verification.

## Still blocked externally

The static DTFSeeds suite cannot mutate the Hostinger filesystem until the protected GitHub `production` environment receives a usable Hostinger SSH user/private-key pair. WordPress REST publishing is a separate path and has already been verified independently.

## Current verification step

A normal `main` push after installation of the standalone WordPress workflow is used as the deterministic trigger test. Production is not considered reconciled until the workflow reports its run ID and the live Home, Seeds, Learn, Community, and Contact checks pass.
