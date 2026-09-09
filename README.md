# DTF / THC Product Repository

This repository is the primary monorepo for DTF Genetics browser games, shared game infrastructure, public-route release artifacts, site integration, and supporting product tooling.

Production target: **https://dtfseeds.com**

## Repository map

- `games/` — canonical source for games owned by this monorepo. Game logic, data, tests, assets manifests, and game-specific documentation belong here.
- `apps/` — standalone application workspaces that are built as applications rather than static game packages, including High Land and GrowLens.
- `site/public-route-patch/` — deployable public-route artifacts. Treat this as a release/deployment layer, not the canonical place to author game logic.
- `site/deployment/` — public application/deployment registry and route metadata.
- `scripts/` — active repository-wide build, validation, synchronization, release, and deployment tooling.
- `scripts/archive/` — retired one-off migration/reconciliation helpers kept only for provenance. Nothing here may be called by active CI or production release flows.
- `docs/` — architecture, source-of-truth, workflow, release, and operational documentation.
- `data/` — repository-level registries and shared machine-readable data. Game-owned data belongs under that game in `games/<game-id>/data/`.
- `assets/` — repository-wide shared assets. Game-owned assets belong with the owning game or its release bundle.
- `.github/workflows/` — active CI/release workflows only. Retired workflows should be removed rather than left capable of mutating current production state.

## Game ownership

Before changing a game, resolve its canonical owner and deployment contract:

```bash
npm run games:status -- --id <game-id>
```

Monorepo-owned games live in `games/`. Some portfolio games remain canonical in standalone repositories. The authoritative ownership and release mappings are recorded in `data/project-registry.json` and `site/deployment/public-apps.json`.

See `games/README.md` for the game architecture contract and `docs/GAME_ARCHITECTURE_STANDARD.md` for the detailed standard.

## Core validation

```bash
npm run games:preflight
npm run verify:portfolio
npm run verify:navigation
npm run verify:release-integrity
```

These checks are intentionally deterministic and repository-based. Do not add Playwright to the routine game validation path.

## Application workspaces

High Land:

```bash
npm run dev:high-land
npm run build:high-land
npm run test:high-land
```

GrowLens:

```bash
npm run build:growlens
npm run test:growlens
npm run verify:growlens
```

## Structural rules

1. Canonical game behavior is authored under its owning source directory, not directly in the public deployment mirror.
2. Public route files must be generated, synchronized, or deliberately copied from canonical source and validated for parity.
3. Game-specific data stays with the game unless it is genuinely shared across the portfolio.
4. One-off migration scripts must not accumulate indefinitely in the active `scripts/` root; archive them after the migration is complete.
5. Active workflows must target the current production contract. Legacy compatibility workflows that can rewrite current files must be retired.
6. Do not create duplicate implementations of the same game in multiple directories without an explicit source-of-truth document and synchronization contract.

## Current priority

The active game-production priority is Seed Man, Who Took It?, High IQ, High Life, Bud or Bluff, and the Doom-style parody project, followed by the remainder of the game portfolio. Each game should move through canonical source, working gameplay, approved visuals, deterministic QA, public route, deployment registry, merge, and live verification.
