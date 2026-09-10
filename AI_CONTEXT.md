# AI Assistant Context for the DTF Games Workspace

## TEMPORARY USER OVERRIDE — GAME RESTRICTIONS ON HOLD

**Status: ACTIVE until explicitly revoked by the user.**

For all DTFSeeds game work, read `docs/GAME_RESTRICTIONS_HOLD.md` before applying older source-of-truth, canonical ownership, backend, preserve-existing-logic, smallest-change, route-lock, architecture-lock, or no-rewrite constraints. While active, the hold allows any game code, asset, UI, engine, backend, route, build/deployment structure, ownership map, or repository layout to be changed when needed to achieve the requested product goal.

Security/credential rules, truthful deployment verification, and higher-level platform requirements remain in force.

---

This file is an orientation index for AI coding agents working in `dtfgenetics/Thc`.

It does **not** override repository rules. `AGENTS.md`, `CLAUDE.md`, route-owner documentation, and game-specific source-of-truth files remain authoritative when instructions conflict, except where `docs/GAME_RESTRICTIONS_HOLD.md` is explicitly active for game work.

## Repository purpose

This repository integrates DTF browser games, cultivation tools, educational content, website production assets, registries, and deployment automation for `https://dtfseeds.com`.

Production branch: `main`

Production site: `https://dtfseeds.com`

Package manager: **npm** using the committed `package-lock.json`

CI Node version: **Node.js 22**

## Read first

Before changing anything:

1. Read `docs/GAME_RESTRICTIONS_HOLD.md` for game work while its status is ACTIVE.
2. Read `AGENTS.md`.
3. Read `CLAUDE.md`.
4. Read the source-of-truth document for the project you are changing as historical/integration context.
5. For game work, read `docs/GAME_DEVELOPMENT_WORKFLOW.md` and `docs/GAME_ARCHITECTURE_STANDARD.md`.
6. For publishing or live-route work, read `.agents/skills/dtfseeds-production-publishing/SKILL.md` and `docs/deployment-hostinger.md`.
7. For High Land, use the additional High Land reading order in `AGENTS.md` as context; the temporary hold suspends its implementation locks.

## Repository map

- `apps/` — application workspaces such as High Land and GrowLens.
- `games/` — locally owned game source, game manifests, tests, and shared game QA.
- `site/public-route-patch/` — visitor-facing packaged website/game runtimes. During the temporary hold it may be restructured or promoted/demoted as part of a deliberate migration.
- `site/deployment/public-apps.json` — production route/runtime/build contract.
- `data/project-registry.json` — current repository ownership and project status map.
- `data/public-navigation.json` — visitor-facing public navigation contract.
- `docs/` — source-of-truth documents, architecture, acceptance criteria, and deployment instructions.
- `content/` — educational/editorial source content.
- `assets/` — shared media/assets.
- `configuration/` — site/content configuration.
- `scripts/` — build, verification, publishing, reconciliation, and maintenance automation.
- `.agents/` — repository-specific agent skills and production procedures.
- `supabase/` — legacy planning where present.

## Game workflow

While the temporary hold is active, ownership resolution is informative rather than restrictive. Use the current source map to understand what exists, then change or migrate ownership when necessary for the requested redesign or repair.

```bash
npm run games:status -- --id <game-id>
```

A game may be edited in its current canonical repository, migrated into another repository, consolidated into the integration repo, or rebuilt from scratch when technically justified. Update the registries and deployment mappings to reflect the resulting architecture instead of keeping stale ownership metadata.

For a new locally owned game:

```bash
npm run games:new -- <kebab-case-id> "Game Title"
```

The scaffold uses the current browser-game architecture, but it is not mandatory during the temporary restriction hold if a different architecture better serves the game.

## Core verification commands

Show the whole game inventory and ownership map:

```bash
npm run games:status
```

Run the unified game preflight when applicable:

```bash
npm run games:preflight
```

Validate the local game workspace when applicable:

```bash
npm run games:verify
```

Validate public navigation and release contracts when applicable:

```bash
npm run verify:navigation
npm run verify:release-integrity
```

Run direct production identity checks when the environment is allowed to access the live site:

```bash
npm run verify:release-integrity:live
```

If the architecture changes, obsolete validation may be replaced with equivalent deterministic tests rather than preserving a validator that no longer represents the product.

## High Land commands

For the current architecture:

```bash
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

High Land currently lives in `apps/high-land-web`; this is not a technical lock while the temporary hold is active. The Hostinger PHP Website Room API remains the current backend, but the prior backend lock is suspended. Any replacement must still protect private room state and credentials.

Playwright remains retired from the active DTFSeeds validation path unless the user explicitly restores it. Use deterministic tests/build/policy checks, direct browser/live-route review, HTTP/resource checks, Lighthouse, and screenshot/image comparison as appropriate.

## GrowLens commands

```bash
npm run test:growlens
npm run build:growlens
npm run test:e2e:growlens
npm run verify:growlens
```

## AI coding rules during the temporary hold

- Inspect current source, tests, assets, registries, and recent changes before editing when useful, but inspection does not prohibit a rewrite.
- Existing game logic may be preserved, modified, or replaced according to the requested goal.
- Existing separation between simulation, rendering, UI, input, networking, and browser objects may be retained or redesigned.
- Existing routes, names, architectures, ownership maps, and backends may be changed when the requested work requires it.
- Stable asset manifests and deterministic serializable state remain recommended engineering practices, not blockers.
- Add or update tests for materially changed behavior when practical.
- Keep hidden multiplayer information and authoritative legality/scoring protected server-side in any architecture that uses hidden information.
- Never commit credentials, tokens, passwords, private room data, service-role keys, or `.env` files.
- Do not call a commit, merge, package, or successful deployment command a live update until the exact production route is verified.

## Standard change sequence during the hold

1. Inspect current `main` and the existing implementation enough to understand what is being replaced or retained.
2. Resolve current ownership for reference.
3. Create or use a branch appropriate to the work.
4. Make the change needed to achieve the requested result, including full rewrites or migrations when justified.
5. Run appropriate deterministic tests/build checks for the resulting architecture.
6. Update ownership, navigation, and deployment metadata if architecture or routes changed.
7. Integrate the validated change.
8. If production behavior changed, verify the exact live dtfseeds.com route separately.

## One-command workstation setup

From the repository root:

```bash
npm run ai:setup
```

That command checks the required tooling, installs the committed dependency graph with `npm ci`, prints the game ownership map, and runs the unified game preflight. If the project architecture changes during the restriction hold, update this setup command rather than treating it as immutable.
