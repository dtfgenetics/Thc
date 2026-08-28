# DTFSeeds game development workflow

Production target: **https://dtfseeds.com**

This document defines the safe path for creating, editing, testing, merging, and publishing games used by the DTF Game Hub.

## Source-of-truth model

Do not create a second competing registry.

- `data/project-registry.json` defines which repository owns each project/game.
- `site/deployment/public-apps.json` defines the dtfseeds.com route, runtime, build command, deployment status, and source path.
- `games/<game-id>/` contains canonical source/data/tests for games owned directly by `dtfgenetics/Thc`.
- `apps/<app-id>/` is used for full application workspaces such as High Land.
- `site/public-route-patch/games/<game-id>/` contains self-hosted visitor-facing runtimes that are packaged into dtfseeds.com.
- Standalone canonical game repositories remain standalone when `data/project-registry.json` assigns ownership there.

## Standard change path

1. Create a branch from current `main`.
   - New work: `feature/game-<id>-<short-change>`
   - Fixes: `fix/game-<id>-<short-fix>`
2. Change only the canonical game source and any required public runtime/deployment metadata.
3. Run the game-specific tests/build.
4. Run `npm run games:verify` from the repository root.
5. Open a pull request into `main`.
6. Let Game workspace CI and any game-specific CI finish successfully.
7. Merge only after required checks pass.
8. Use the existing dtfseeds.com WordPress/Hostinger deployment workflow for production.
9. Run the live-site audit/route verification after deployment.

This keeps editing fast while preventing one game change from silently breaking another route.

## Creating a new locally owned game

Use:

```bash
npm run games:new -- my-game "My Game"
```

The scaffold creates:

```text
games/my-game/
  README.md
  game.json
  src/
  data/
  test/
  docs/
```

The scaffold is intentionally **not deployable**. It does not add a public route and does not modify the production deployment manifest.

Before the game can be published:

1. Register ownership/status in `data/project-registry.json`.
2. Build deterministic rules/data tests where possible.
3. Add the visitor runtime only when it is usable.
4. If self-hosted by the DTF master repo, place the public runtime at `site/public-route-patch/games/<id>/`.
5. Add/update the app entry in `site/deployment/public-apps.json` with route, runtime, status, source path, and build command.
6. Set the route in `game.json` when a real route exists.
7. Run `npm run games:verify` and the game-specific tests.
8. Open a PR.

## Editing an existing game

First identify ownership in `data/project-registry.json`.

### Game owned by `dtfgenetics/Thc`

Edit its canonical path in this repo. Common patterns:

- `games/<id>/` — rules, engine, data, tests
- `apps/<id>/` — application workspace
- `site/public-route-patch/games/<id>/` — production-facing static/PHP runtime

If a public route copies or bundles canonical machine data, update both through the existing build/sync process and verify they remain consistent.

### Game owned by another DTF repository

Edit the standalone canonical repository first. Do not fork a second implementation into `dtfgenetics/Thc` just because the Game Hub links to it.

Only update `site/deployment/public-apps.json` or integration files here when the dtfseeds.com packaging/runtime contract changes.

## What Game workspace CI checks

`npm run games:verify` fails the PR for structural problems that can break production, including:

- deployment manifest no longer targets `https://dtfseeds.com`
- duplicate deployment IDs
- duplicate public routes
- malformed route paths
- missing build metadata for `ready-to-package` apps
- missing local `sourcePath` targets
- packaged local browser routes missing `index.html`
- missing local source-of-truth documents
- malformed `game.json` IDs or routes

Non-blocking warnings identify older game folders that do not yet have the preferred README/game manifest structure.

## Game-specific verification

The workspace check is not a substitute for gameplay tests. Every active game should have its own smallest reliable verification command.

Examples already represented in `site/deployment/public-apps.json` include engine tests, data validators, JavaScript syntax checks, PHP linting, browser builds, and multiplayer security checks.

When adding a new game, put its production verification command into the deployment manifest. That makes the required test discoverable by humans and automation.

## Public status rules

Use status deliberately:

- `ready-to-package` means a visitor-facing build exists and has a concrete verification command.
- `runtime-integration` means the browser/client exists but production depends on a separate server/runtime.
- prototype/alpha/preproduction statuses must not be presented as finished public games unless a separate tested public vertical slice is intentionally exposed.
- placeholders must not receive fake Play buttons.

The Game Hub should continue separating playable games from development projects.

## Production safety

Do not use a game feature branch as a deployment branch. `main` remains the integration line.

Do not hand-copy an external canonical game into the master repo unless ownership is intentionally being migrated and the project registry is updated in the same change.

Do not register an unfinished game in `site/deployment/public-apps.json` as `ready-to-package` just to make it appear in production.

Do not bypass failed verification to push a game live. Fix the failing contract or explicitly change the contract in a reviewed PR.

## Rollback

If a merged game change breaks production:

1. Revert the smallest offending merge/commit in GitHub.
2. Let the same verification checks run on the revert.
3. Redeploy the known-good `main` state using the existing production workflow.
4. Run the dtfseeds.com live-site audit and the affected game route checks.
5. Continue the fix on a new `fix/game-...` branch.

This makes rollback a source-control operation instead of an emergency manual file-editing process on the live host.
