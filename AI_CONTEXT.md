# AI Assistant Context for the DTF Games Workspace

This file is an orientation index for AI coding agents working in `dtfgenetics/Thc`.

It does **not** override repository rules. `AGENTS.md`, `CLAUDE.md`, route-owner documentation, and game-specific source-of-truth files remain authoritative.

## Repository purpose

This repository integrates DTF browser games, cultivation tools, educational content, website production assets, registries, and deployment automation for `https://dtfseeds.com`.

Production branch: `main`

Production site: `https://dtfseeds.com`

Package manager: **npm** using the committed `package-lock.json`

CI Node version: **Node.js 22**

## Read first

Before changing anything:

1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read the source-of-truth document for the project you are changing.
4. For game work, read `docs/GAME_DEVELOPMENT_WORKFLOW.md` and `docs/GAME_ARCHITECTURE_STANDARD.md`.
5. For publishing or live-route work, read `.agents/skills/dtfseeds-production-publishing/SKILL.md` and `docs/deployment-hostinger.md`.
6. For High Land, follow the additional High Land reading order in `AGENTS.md`.

## Repository map

- `apps/` — application workspaces such as High Land and GrowLens.
- `games/` — canonical locally owned game source, game manifests, tests, and shared game QA.
- `site/public-route-patch/` — visitor-facing packaged website/game runtimes. This is a deployment surface, not automatically the canonical source.
- `site/deployment/public-apps.json` — production route/runtime/build contract.
- `data/project-registry.json` — canonical repository ownership and project status.
- `data/public-navigation.json` — visitor-facing public navigation contract.
- `docs/` — source-of-truth documents, architecture, acceptance criteria, and deployment instructions.
- `content/` — educational/editorial source content.
- `assets/` — shared media/assets.
- `configuration/` — site/content configuration.
- `scripts/` — build, verification, publishing, reconciliation, and maintenance automation.
- `.agents/` — repository-specific agent skills and production procedures.
- `supabase/` — legacy planning only where present; it is not the active High Land multiplayer authority.

## Game workflow

Before editing a game, resolve its owner:

```bash
npm run games:status -- --id <game-id>
```

If `canonicalRepository` is `dtfgenetics/Thc`, edit the canonical local source identified by the status output and source-of-truth documentation.

If another repository is canonical, edit that repository first. Do not create a competing implementation in this integration repo.

For a new locally owned game:

```bash
npm run games:new -- <kebab-case-id> "Game Title"
```

The scaffold uses the `dtf-browser-game-v1` architecture and is intentionally non-public until its release gates are completed.

## Core verification commands

Show the whole game inventory and ownership map:

```bash
npm run games:status
```

Run the unified game preflight:

```bash
npm run games:preflight
```

Validate the local game workspace only:

```bash
npm run games:verify
```

Validate public navigation and release contracts:

```bash
npm run verify:navigation
npm run verify:release-integrity
```

Run direct production identity checks when the environment is allowed to access the live site:

```bash
npm run verify:release-integrity:live
```

## High Land commands

```bash
npm run test:high-land
npm run build:high-land
npm run test:e2e:high-land
```

High Land canonical web source lives in `apps/high-land-web`.

The active multiplayer backend is the Hostinger PHP Website Room API. Do not reconnect Supabase, Firebase, or another room authority unless the product decision is explicitly changed.

## GrowLens commands

```bash
npm run test:growlens
npm run build:growlens
npm run test:e2e:growlens
npm run verify:growlens
```

## AI coding rules

- Inspect current source, tests, assets, registries, and recent changes before editing.
- Preserve existing game logic unless the requested change requires modifying it.
- Keep simulation/rules separate from rendering, UI, input, networking, and browser objects when using `dtf-browser-game-v1`.
- Keep important gameplay state serializable and deterministic where practical.
- Use stable asset-manifest keys instead of scattering hard-coded asset filenames through gameplay code.
- Add or update tests when changing rules, movement, scoring, multiplayer authorization, persistence, routing, or deployment behavior.
- Keep hidden multiplayer information and authoritative legality/scoring on the server.
- Never commit credentials, tokens, passwords, private room data, service-role keys, or `.env` files.
- Do not rename games, public routes, domains, or locked brand terms without explicit direction.
- Do not treat `site/public-route-patch/` as a second canonical implementation when another source owns the game.
- Do not call a commit, merge, package, or successful deployment command a live update until the exact production route is verified.

## Standard change sequence

1. Inspect current `main` and the relevant source-of-truth files.
2. Run `npm run games:status -- --id <game-id>` for game work.
3. Create a current-main branch.
4. Make the smallest correct change in the canonical source.
5. Run game-specific tests.
6. Run `npm run games:preflight`.
7. Open a PR and wait for the relevant current-head CI checks.
8. Merge only a current, mergeable, validated PR.
9. If production behavior changed, verify the exact live dtfseeds.com route separately.

## One-command workstation setup

From the repository root:

```bash
npm run ai:setup
```

That command checks the required tooling, installs the committed dependency graph with `npm ci`, prints the game ownership map, and runs the unified game preflight.
