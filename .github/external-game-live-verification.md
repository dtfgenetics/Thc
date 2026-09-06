# External game live verification gate

Production run `34012836416` successfully rebuilt and transactionally published the current promotable external game contracts, including Ganjumanji at `e82580daa684fc7733ef6cfcb12a502939a609dd` and THC RPG at `15fe22d69afaee906714a1ad0933505e437202dd`.

The durable promotion gate is implemented by `.github/workflows/verify-external-game-live.yml` and `scripts/verify-external-game-live.mjs`.

A candidate is not considered live merely because packaging or deployment succeeds. The post-deploy verifier requires the canonical route to return HTTP 200 without redirect, the deployed `game-release.json` to match the contract identity and route, the deployed `source-revision.txt` to match the exact pinned repository/commit/route, and every local JavaScript, CSS, module, or JSON runtime reference in the live HTML to resolve successfully.

The production Game Hub count remains unchanged until this exact live gate passes and a separate reviewed promotion changes release status/navigation.
