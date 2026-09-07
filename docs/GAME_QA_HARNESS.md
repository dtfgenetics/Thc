# DTF Game QA Harness

The DTF Game QA Harness is the shared browser-quality layer for the DTFSeeds game portfolio.

It does **not** replace each game's deterministic rules tests, build checks, game-specific Playwright suites, or canonical release verifier. It supplies the cross-game checks that should not be rewritten separately for every title.

## Authority

The harness does not own a duplicate game list.

- `data/game-source-map.json` supplies public game IDs, routes, canonical repositories, canonical source paths, and integration mode.
- `site/deployment/public-apps.json` supplies deployment/build metadata.
- `configuration/game-qa/browser-contracts.json` contains only browser-QA behavior that cannot be derived from those registries.

Registry drift is reported before browser execution.

## Commands

```bash
npm run games:qa:catalog
npm run games:qa:catalog-check
npm run games:qa:browser
npm run games:qa:live
```

Limit a run to one or more game IDs:

```bash
node scripts/game-portfolio-browser-qa.mjs --local --game high-iq,high-life
node scripts/game-portfolio-browser-qa.mjs --live --game high-land
```

Use `--strict` to turn warnings/catalog drift into a failing exit code.

## Local mode

Local mode starts a no-cache static server rooted at `site/public-route-patch` and tests every game whose canonical integration mode is `local-static` and whose checked-in integration contains `index.html`.

Games built from another application (`local-build`) or an external canonical repository (`external-build`) are explicitly reported as skipped rather than silently treated as tested. Their game-specific build/Playwright suite remains authoritative until the public suite assembles them.

## Live mode

Live mode uses the canonical site URL from the source/deployment registry, defaulting to `https://dtfseeds.com`.

It checks every resolved game route unless `--game` narrows the run.

A live browser pass is visitor-facing QA evidence. It is still separate from the canonical release evidence ladder in `dtf-game-canonical-release`: a scheduled portfolio pass must not be used to claim that an unmerged source change was deployed.

## Shared browser checks

Each selected route runs at two baseline viewports:

- desktop: `1440 × 900`
- mobile: `390 × 844`, touch enabled

The runner currently verifies:

- navigation returns a usable response;
- the final route is the expected game route rather than a fallback/redirect;
- document title exists;
- visible body content is non-empty;
- horizontal overflow stays within the configured tolerance;
- configured required selectors/text are present;
- page exceptions are captured;
- browser-console errors are captured;
- same-origin failed requests are captured;
- an interactive surface is present (warning when none is obvious);
- screenshots are captured for visual review.

Every browser context runs with reduced motion requested so the portfolio continuously exercises that accessibility path.

## Artifacts

Every run writes a timestamped directory under `artifacts/game-qa/` containing:

- `results.json` — machine-readable result and evidence data;
- `summary.md` — human-readable PASS/WARN/FAIL table;
- `screenshots/` — desktop and mobile screenshots for every tested game.

CI uploads the complete artifact set even on failure.

## CI

`.github/workflows/game-portfolio-browser-qa.yml` provides three execution paths:

1. **Pull requests** affecting game QA, registries, package scripts, or checked-in game routes run local portfolio QA.
2. **Scheduled execution** runs live QA every day.
3. **Manual dispatch** can select local/live mode and optionally one game ID.

The catalog job always runs before the browser job.

## What remains game-specific

The shared harness intentionally does not guess how to win or finish every game. Individual canonical game suites still own:

- exact start/new-game interaction;
- rules/legal-action validation;
- win/loss completion;
- multiplayer synchronization;
- save migration behavior;
- game-specific accessibility semantics;
- exact production markers and stale fingerprints.

As games are improved, `configuration/game-qa/browser-contracts.json` may add small stable browser requirements, but complex gameplay belongs in the canonical game's own test suite.

## Next shared-system integrations

After the QA harness is stable, the portfolio-upgrade roadmap should add:

1. deterministic replay/debug export contract;
2. shared audio/settings and accessibility preference contract;
3. asset/performance budget validation;
4. optional DTF Player Passport/achievements interface;
5. telemetry/balance event schema.

Those systems should use the same game IDs/routes resolved by the QA catalog instead of introducing new identity registries.
