# Dtf420 Atlas live acceptance

The canonical interactive Atlas child-route surface is `/learn/atlas/` and remains owned by the reviewed Dtf420 static overlay. WordPress continues to own the `/learn/` hub.

## Acceptance contract

After a successful `Deploy DTFSeeds Public Suite via WordPress V2` run, `.github/workflows/verify-dtf420-atlas-live.yml` automatically executes `scripts/verify-dtf420-atlas-live.mjs` against `https://dtfseeds.com`.

The verifier requires:

- HTTP 200 with no redirect for the Atlas hub and one representative lesson from each of the 10 canonical systems.
- `https://dtfseeds.com` canonical metadata and Dtf420 `_next/static` assets on each checked page.
- no retired `dtf420.com` URL leakage.
- no visible `/dtf-content-overlay/learn/` staging path leakage.
- HTTP 200 with no redirect for the nested Three.js runtime HTML and JavaScript.
- expected Three.js runtime fingerprints (`atlas-runtime.js`, `canvas`, `startAtlasRuntime`, `OrbitControls`).
- preservation of the WordPress-owned `/learn/` hub without a public staging-path leak.

A successful repository build or deployment write is not enough to call the Atlas live. The post-deployment acceptance workflow must pass for the corresponding production release.
