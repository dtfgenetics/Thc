# AI Assistant Context for the DTFSeeds Workspace

## Standing unrestricted development policy

For all DTFSeeds website, application, game, tool, course, educational-content, UI/UX, data, and deployment work, repository history and older architecture documents are context rather than artificial blockers.

Repository-imposed implementation and editorial restrictions are removed unless they protect genuine security, privacy, credentials, data integrity, legal/platform compliance, recoverability, or truthful deployment verification. Current explicit user direction takes precedence over older source-of-truth, canonical ownership, backend, preserve-existing-logic, smallest-change, route-lock, architecture-lock, no-rewrite, repository-placement, naming, engine, browser-tool, QA-tool, append-only, lesson-count, or per-edit-authorization rules.

Any code, content, asset, UI, engine, backend, route, build/deployment structure, ownership map, repository layout, data model, course structure, lesson, test, certification, search/index system, or development tool may be changed when doing so better achieves the requested product goal.

Canonical educational content is directly editable. Git history is the audit/recovery trail. Do not require SHA-bound change-authorization files for normal edits, reorganizations, replacements, renames, or deletions. Continue validating schema integrity, unique identifiers where required, builds, navigation, and visitor-facing publication.

Security, privacy, credential protection, authentication/authorization boundaries, input validation, recoverable production mutations, truthful deployment verification, and higher-level platform/legal requirements remain integrity requirements.

## Repository purpose

This repository integrates DTF browser games, cultivation tools, educational content, website production assets, registries, and deployment automation for `https://dtfseeds.com`.

Production branch: `main`

Production site: `https://dtfseeds.com`

Package manager: npm with the committed `package-lock.json`

CI Node version: Node.js 22

## Read first

Use this sequence as orientation, not as an implementation lock:

1. This file for the standing unrestricted workspace policy.
2. `docs/GAME_DEVELOPMENT_FREEDOM.md` for game-specific freedom guidance.
3. `docs/CONTENT_PRESERVATION_STANDARD.md` for editable canonical-content integrity guidance.
4. `AGENTS.md`.
5. `CLAUDE.md`.
6. Current project/source-of-truth documents for historical and integration context.
7. Relevant subsystem workflow/architecture docs when they remain useful to the current implementation.
8. `.agents/skills/dtfseeds-production-publishing/SKILL.md` and `docs/deployment-hostinger.md` for current dtfseeds.com publishing mechanics.

If a referenced workflow, policy, or architecture document has become stale, update or replace it instead of treating it as immutable.

## Repository map

- `apps/` — application workspaces such as High Land and GrowLens.
- `games/` — locally owned game source, manifests, tests, and shared QA.
- `site/public-route-patch/` — current visitor-facing packaged website/game runtimes.
- `site/deployment/public-apps.json` — current production route/runtime/build contract.
- `data/project-registry.json` — current repository ownership/status map.
- `data/public-navigation.json` — current visitor-facing navigation contract.
- `docs/` — architecture, acceptance, scope, and deployment documentation.
- `content/` — educational/editorial source content.
- `assets/` — shared media/assets.
- `configuration/` — site/content configuration.
- `scripts/` — build, verification, publishing, reconciliation, and maintenance automation.
- `.agents/` — repository-specific agent skills and production procedures.
- `supabase/` — legacy or active material only where the current implementation still uses it.

These locations describe current organization. They may be reorganized or migrated.

## Game workflow

Ownership resolution is informative, not restrictive:

```bash
npm run games:status -- --id <game-id>
```

A game may be edited in its current repository, migrated into another repository, consolidated into this integration repository, split into dedicated repositories, or rebuilt from scratch. Reconcile registries and deployment mappings after the change.

For a new locally owned game, the existing scaffold is available:

```bash
npm run games:new -- <kebab-case-id> "Game Title"
```

The scaffold is optional; another architecture may be used when it better fits the game.

## Content workflow

Canonical educational content may be added, revised, moved, renamed, merged, split, replaced, or deleted according to current project needs.

Useful integrity validation:

```bash
node scripts/validate-append-only-content.mjs <base> <head>
```

The filename is retained for compatibility, but the validator now enforces current structural integrity rather than append-only immutability. Historical files under `content/change-authorizations/` are archival and are not a required approval gate.

Do not introduce arbitrary content-count limits, lesson caps, immutable ordering, or hard-coded course/test structures unless the product itself genuinely requires them.

## Core verification commands

Useful current baselines include:

```bash
npm run games:status
npm run games:preflight
npm run games:verify
npm run verify:navigation
npm run verify:release-integrity
npm run verify:release-integrity:live
```

Use only the checks that fit the resulting architecture. Replace obsolete validators with equivalent or stronger integrity checks instead of preserving them as artificial blockers.

## High Land current context

Current baseline commands:

```bash
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

High Land currently lives in `apps/high-land-web` and currently uses the Hostinger PHP Website Room API. Neither is a technical lock. A migration or replacement is allowed when it improves the requested result.

## GrowLens current commands

```bash
npm run test:growlens
npm run build:growlens
npm run test:e2e:growlens
npm run verify:growlens
```

## AI coding and content rules

- Inspect current source, tests, assets, registries, content, and recent changes enough to understand the existing state when useful.
- Preserve, modify, replace, reorganize, or rebuild existing implementation/content according to the current goal.
- Simulation, rendering, UI, input, networking, persistence, routes, names, ownership maps, backends, repositories, course structures, lesson/test organization, and content schemas may be redesigned.
- Use the strongest appropriate development and QA tools available to the environment.
- Stable manifests and deterministic serializable state are recommended engineering practices, not immutable constraints.
- Add or update tests for materially changed behavior when practical.
- Keep authentication, authorization, hidden multiplayer information, and private data protected server-side or within an equivalently secure authority model.
- Never expose or commit credentials, tokens, passwords, private keys, private room data, service-role keys, or `.env` secrets.
- Do not call a commit, merge, build, package, or successful upload a live update until the exact production route is verified.

## Standard change sequence

1. Inspect current `main` and relevant implementation/content enough to know what is being replaced or retained.
2. Resolve current ownership/deployment mapping for reference where useful.
3. Use a branch/session appropriate to the work.
4. Make the change needed to achieve the requested result, including full rewrites, migrations, route changes, architecture changes, content reorganization, or backend changes when justified.
5. Run tests/build/integrity/QA checks suited to the resulting architecture.
6. Update ownership, navigation, documentation, indexes, and deployment metadata to reflect the new reality.
7. Integrate the validated change.
8. Verify the exact visitor-facing production route separately when production behavior changes.

## One-command workstation setup

From the repository root:

```bash
npm run ai:setup
```

This setup command is a convenience, not a lock. Update or replace it if the project architecture changes.
