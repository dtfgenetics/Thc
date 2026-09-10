# AI Assistant Context for the DTF Games Workspace

DTFSeeds game development is currently open for full redesign and implementation work. No project-level restrictions are active on game code, architecture, renderers, engines, backends, assets, routes, repository structure, build systems, browser tooling, QA tooling, naming, ownership, or preservation of existing implementations.

This repository integrates DTF browser games, cultivation tools, educational content, website production assets, registries, and deployment automation for `https://dtfseeds.com`.

## Environment

- Repository: `dtfgenetics/Thc`
- Production branch: `main`
- Production site: `https://dtfseeds.com`
- Package manager: npm with the committed `package-lock.json`
- CI Node version: Node.js 22

## Repository map

- `apps/` — application workspaces such as High Land and GrowLens.
- `games/` — locally owned game source, manifests, data, tests, and tools.
- `site/public-route-patch/` — visitor-facing packaged website/game runtimes.
- `site/deployment/public-apps.json` — deployment/runtime mapping.
- `site/deployment/release-resources.json` — resource publication metadata.
- `data/project-registry.json` — current project/repository map.
- `data/public-navigation.json` — visitor-facing navigation data.
- `docs/game-art/visual-rebuild/` — current game visual redesign briefs and responsive asset standard.
- `scripts/` — build, verification, publishing, reconciliation, migration, and maintenance automation.
- `.agents/` — optional repository-specific workflow helpers.

## Current development direction

The current goal is a portfolio-wide game redesign and code cleanup. Existing implementations, ownership maps, backends, build paths, validators, visual systems, and public-route packages are working material rather than immutable contracts. Replace, restructure, consolidate, migrate, or remove them when that improves the resulting game and production system.

Responsive work targets intentional phone, tablet, laptop/desktop, and large-screen compositions rather than a single desktop layout scaled down.

## Useful commands

```bash
npm run games:status
npm run games:preflight
npm run games:verify
npm run verify:navigation
npm run verify:release-integrity
npm run verify:release-integrity:live
npm run test:high-land
npm run build:high-land
npm run test:growlens
npm run build:growlens
```

Use checks that match the resulting architecture. Replace or remove obsolete validators when they enforce retired implementation details instead of product correctness.

## Current High Land implementation

High Land currently lives under `apps/high-land-web`. The current multiplayer implementation uses the Hostinger PHP Website Room API. These are present-state facts, not locked architecture decisions.

## Practical change sequence

1. inspect the current source and visitor-facing route;
2. identify duplicated, stale, broken, or conflicting implementation layers;
3. make the redesign or repair needed for the intended game;
4. validate the resulting build, data, gameplay, browser behavior, and responsive composition;
5. update route and deployment metadata when ownership or architecture changes;
6. publish through the appropriate production path;
7. verify the exact live route and critical assets.

This sequence is guidance, not an implementation restriction.
