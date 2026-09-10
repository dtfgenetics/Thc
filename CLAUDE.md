# THC Games Workspace

DTFSeeds game development is currently open for full redesign and implementation work. No project-level restrictions are active on game code, architecture, engines, renderers, backends, assets, routes, repository structure, build systems, browser tooling, QA tooling, naming, or ownership.

This repository is the working codebase for the DTF / THC browser games and website game hub.

## Current repository orientation

- Production branch: `main`
- Production site: `https://dtfseeds.com`
- High Land app currently: `apps/high-land-web`
- Current High Land multiplayer implementation: `apps/high-land-web/public/api/`
- Game source: `games/`
- Public packaged routes: `site/public-route-patch/games/`
- Visual redesign briefs: `docs/game-art/visual-rebuild/`

Existing implementations are starting points, not locked contracts. Code, data flow, multiplayer, visual systems, routes, and build/deployment structure may be redesigned, replaced, consolidated, or moved as needed for the current product goals.

## Useful commands

Current commands include:

```bash
npm ci
npm run games:status
npm run games:preflight
npm run games:verify
npm run test:high-land
npm run build:high-land
```

Use the checks that remain relevant to the architecture being changed. Obsolete validation should be updated or removed when it no longer represents the game.

## Current product direction

The portfolio is being rebuilt toward high-quality browser-game presentation across phone, tablet, laptop, desktop, and large screens. The game world, board, table, stage, or playfield should be visually dominant, while UI, HUD, menus, controls, multiplayer, accessibility, and site integration support the play experience.

The current Hostinger PHP Website Room API, current visual assets, current repository locations, and existing game rules are all changeable implementation details during this redesign.
