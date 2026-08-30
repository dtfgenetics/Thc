---
name: dtf-game-canonical-release
description: Repair, validate, package, deploy, and live-verify DTFSeeds games by resolving each game's canonical source first and following the public-suite production pipeline without confusing CI success with browser-tested production behavior.
---

# DTF game canonical release workflow

Use this skill for any DTFSeeds game task that asks to repair, finish, sync, publish, deploy, push live, or verify a game under `https://dtfseeds.com/games/`.

The release contract is:

**source of truth → canonical source repo → canonical validation → reviewed/merged source → exact source pin or integration sync in `dtfgenetics/Thc` → public-suite validation → production deployment → exact live-route verification → browser gameplay verification when available**

## Non-negotiable rules

1. Resolve the game's owner before editing. Read the current versions of `docs/PROJECT_SOURCE_OF_TRUTH.md`, `data/project-registry.json`, `data/site-registry.json`, `site/deployment/public-apps.json`, and any game-specific `SOURCE_OF_TRUTH.md` or skill.
2. If the registry points to an external canonical game repository, repair that repository first. Do not make `site/public-route-patch/games/<slug>/` the master merely because it is convenient to edit.
3. If the registry says the game is local to `dtfgenetics/Thc`, repair the documented local source, not a generated delivery directory.
4. Re-read the canonical repository's current `main` immediately before branching and again before merge/pin. Concurrent automation and other agents may move `main`.
5. Preserve unrelated and user-authored changes. If another valid commit makes your branch redundant, close/drop the redundant branch instead of forcing stale work over newer source.
6. Do not weaken a validator merely to make CI green. First prove the validator is enforcing the wrong invariant. Keep real source, asset, route, and gameplay contracts intact.
7. A successful source test, suite build, or deploy is not proof that the game works in a browser. Keep every evidence level separate.

## Evidence ladder

Report the highest level actually proven:

1. **SOURCE VALIDATED** — canonical tests/build/validators pass.
2. **SUITE VALIDATED** — the DTFSeeds public-suite build packages the intended source and passes route/base-path checks.
3. **DEPLOYED** — a production deployment run containing the intended source SHA/descendant completed successfully.
4. **LIVE ROUTE VERIFIED** — a fresh cache-busted production check confirms the exact route, positive release markers, required assets, and absence of known stale fingerprints.
5. **BROWSER PLAYTESTED** — a real browser/E2E run exercised the required game flow and interaction behavior.

Never promote one level into the next. In particular, do not set or report `browserTested: true` from Node tests, static crawls, HTTP 200 responses, or deployment logs.

## Standard execution sequence

### 1. Resolve canonical ownership

Read the registries and source-of-truth documents first. Record:

- public slug and expected URL,
- canonical repository or local source path,
- expected branch,
- canonical build/test commands,
- integration/package path in `dtfgenetics/Thc`,
- required production workflow,
- existing live verifier or browser acceptance workflow.

When the registry and a copied integration snapshot disagree, the documented canonical source wins unless the source-of-truth contract itself is being intentionally changed.

### 2. Audit the actual failure in canonical source

Inspect source, tests, assets, and recent CI logs. Classify the failure before changing code:

- startup/module/data loading,
- gameplay/state race,
- control/input ownership,
- save/persistence,
- mobile/responsive UI,
- missing/bad asset,
- packaging/base-path issue,
- wrong redirect/route ownership,
- deployment/caching problem,
- or verifier false positive/false negative.

Fix the smallest correct layer. Do not patch a downstream snapshot to hide an upstream canonical failure.

### 3. Validate canonical source

Run the game's own current tests/build/validation commands. Add regression coverage for the bug being repaired when practical.

For browser games, include startup/static asset checks and behavior tests that are possible without falsely labeling them browser tests. Guard browser APIs when restricted storage/history/clipboard/matchMedia or delayed async callbacks can break/re-enter a new game state.

Only continue to release when the canonical source gate is green, or when a documented independent packaging-only repair does not modify gameplay source.

### 4. Merge canonical repair and pin/sync it into DTFSeeds

After canonical validation:

- refetch canonical `main`,
- reconcile concurrent changes,
- merge the canonical repair,
- record the exact passing source SHA,
- update the `dtfgenetics/Thc` release pin/integration metadata when the public-suite workflow uses one,
- do not replace the external canonical source with a hand-copied static snapshot.

When `build-dtfseeds-public-suite.yml` clones/builds an external repo, preserve that architecture. The suite should package the canonical build output over any generic integration placeholder where the workflow specifies that behavior.

### 5. Run the full public-suite gate

Use the current `.github/workflows/build-dtfseeds-public-suite.yml` and related game workspace checks. Require the intended game build, route/base-path verification, release assembly, and artifact packaging to pass.

If the suite fails because another game's canonical source is broken, repair that game's canonical source or use the repository's documented safe pinning mechanism. Do not silently remove the failing game from the public suite.

### 6. Qualify the production deploy

Follow `.github/workflows/deploy-public-suite-wordpress-v2.yml` or the route's documented replacement workflow through completion.

A deploy counts only if its head/source contains the intended release. If a run is cancelled or superseded, follow the newest successful descendant instead of calling the cancelled run a content failure.

Never claim a game is live from a prior successful deploy that predates the repair.

### 7. Verify the exact live route

Use a fresh cache-busting request from CI/origin where possible. The live gate must check more than HTTP 200.

Require as applicable:

- final route/path is exactly the intended game route,
- no unexpected same-origin or cross-origin redirect,
- expected title and unique production UI markers,
- required JS/CSS/data files return success,
- essential game artwork/assets return success and plausible content type/size,
- expected manifest/source-version fingerprints,
- known retired/stale/dev fingerprints are absent,
- route did not fall back to `/games/` or another app.

A same-origin wrong redirect is a failure. `/games/bud-or-bluff/` resolving to `/games/` must never pass merely because both are on `dtfseeds.com`.

Prefer a game-specific verifier workflow when one exists. If it does not exist, add a small verifier that encodes the game's positive and negative fingerprints rather than relying on a generic crawler alone.

### 8. Browser gameplay verification

When real browser tooling/Playwright is available, exercise the critical user flow separately from static live verification. Check console/network errors, start/restart lifecycle, primary controls, a meaningful gameplay transition, and mobile viewport behavior when in scope.

If browser tooling is unavailable, report `LIVE ROUTE VERIFIED` but **not** `BROWSER PLAYTESTED`.

## Live verifier pattern proven by Weedopolis

The Weedopolis verifier demonstrates the preferred static production gate:

- request `https://dtfseeds.com/games/weedopolis/` with a unique cache-busting query,
- fail on non-200 or any unexpected redirect,
- require production page markers such as `Start Weedopolis`, board/UI identifiers, and production CSS/JS references,
- fetch every essential runtime asset independently,
- verify the approved V1 board asset and manifest/registry invariants,
- reject retired fingerprints such as `The playable development build is loading.`,
- print the exact failing asset/status instead of retrying blindly until the job times out.

Use the same pattern for other games, but substitute that game's canonical markers/assets. Do not copy Weedopolis-specific assertions into unrelated games.

## Examples

### External canonical repo

Terpocalypse is mapped to `dtfgenetics/Terpocalapse`; its canonical browser source is `prototypes/web-fps-v2`. Repair there first, validate there, then resync/package the verified source into the public suite. Treat `dtfseeds.com/games/terpocalypse/` integration files as deployment output/snapshot unless the registry contract changes.

### Local game source

For a game owned directly by `dtfgenetics/Thc`, edit the documented local game source, run its dedicated tests/CI, then package through the same suite/deploy/live-verification ladder.

## Required completion report

For every game release, report:

- canonical source repo/path and exact passing SHA,
- changed files and regression covered,
- canonical test/build result,
- public-suite result,
- production deploy run/SHA that contains the change,
- live verifier result and route,
- browser playtest result or `NOT TESTED`,
- any remaining issue or uncertainty.

Do not say “fixed,” “live,” or “all good” without naming the highest evidence level actually achieved.