# High IQ — Test Higher Cognition

High IQ is the DTF / THC cannabis knowledge game. This directory records the currently published browser build and its website-integration target.

## Current public build

- **Title:** High IQ — Test Higher Cognition
- **Provider:** Base44
- **Public URL:** https://inescapable-grow-smart-lab.base44.app/
- **Status:** Playable external build
- **DTF website route:** `/games/high-iq/`
- **Recorded:** 2026-08-15

The public URL was verified reachable on 2026-08-15 and identifies the application as High IQ — Test Higher Cognition.

## Integration rule

Until the Base44 source project is available to this repository, treat the Base44 URL as an external runtime dependency rather than copied source code. Do not represent this directory as a self-hosted copy of the Base44 application.

The DTF website can safely expose `/games/high-iq/` as the branded landing page and launch the current Base44 build from there. If the Base44 project is later exported or connected, migrate the application into a dedicated GitHub-managed web app and replace the external runtime dependency only after validating feature parity.

## Migration target

When source access is available:

1. Export or connect the actual Base44 project source.
2. Add the browser app under a dedicated application directory such as `apps/high-iq-web/`.
3. Preserve the question database, scoring, categories, responsive behavior, and any authentication/data dependencies.
4. Build and test the self-hosted version.
5. Deploy it to `https://dtfseeds.com/games/high-iq/`.
6. Keep the Base44 URL as a rollback reference until the DTF-hosted build is verified.

See `game.json` in this directory for machine-readable integration metadata.
