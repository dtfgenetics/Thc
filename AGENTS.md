# Repository agent context

DTFSeeds game development is currently open for full redesign and implementation work. No project-level game code, architecture, renderer, backend, asset, route, repository-layout, build-tool, browser-tool, QA-tool, naming, ownership, or preserve-existing-implementation restrictions are active.

This repository is the integration and production workspace for DTF / THC browser games, cultivation tools, educational content, website assets, registries, and deployment automation for `https://dtfseeds.com`.

## Useful orientation

- `AI_CONTEXT.md` — workspace map and common commands.
- `apps/` — application workspaces.
- `games/` — game source, data, tests, and game-specific tools.
- `site/public-route-patch/` — visitor-facing packaged routes.
- `site/deployment/` — deployment metadata and resource ownership.
- `data/` — project and navigation registries.
- `docs/game-art/visual-rebuild/` — current visual redesign briefs and responsive production standard.
- `scripts/` — build, validation, publishing, migration, and maintenance automation.
- `.agents/skills/` — optional workflow helpers.

## Current production focus

The active goal is to redesign and improve the full DTFSeeds game portfolio, remove obsolete or conflicting code, connect the best available implementations, improve responsive presentation for phone/tablet/desktop, and publish verified production routes.

Existing source, tests, documentation, branches, visual references, and deployment paths are useful evidence about the current system. They may be changed, replaced, moved, consolidated, or removed when the redesign or repair requires it.

## Useful workflow

A practical sequence is:

1. inspect the current implementation and live route;
2. identify stale, duplicated, conflicting, or broken code;
3. implement the intended game and visual design;
4. run the relevant build, syntax, data, gameplay, browser, and responsive checks available for the resulting architecture;
5. update deployment mappings when source ownership or routes change;
6. publish through the working production path;
7. verify the visitor-facing route and assets.

These steps are workflow guidance rather than implementation locks.

## High Land current location

High Land currently lives under `apps/high-land-web` and is served at `https://dtfseeds.com/games/high-land/`. Its current multiplayer implementation uses the Hostinger PHP Website Room API. Both the application structure and backend may be redesigned or replaced as part of current development.

## Repository

- GitHub: `dtfgenetics/Thc`
- Production branch: `main`
- Production site: `https://dtfseeds.com`
