# Repository Agent Instructions

## Standing game-development policy

For all DTFSeeds game and game-adjacent work, read `docs/GAME_DEVELOPMENT_FREEDOM.md` first.

The repository has **no project-imposed implementation locks** for games. Current explicit user direction takes precedence over older `locked`, `canonical only`, `smallest change`, `preserve existing logic`, no-rewrite, backend-lock, route-lock, architecture-lock, ownership-lock, repository-placement, naming, engine, browser-tool, or QA-tool restrictions.

Developers and agents may modify, replace, restructure, migrate, rewrite, consolidate, split, move, or remove game code, assets, rendering, UI, UX, backends, APIs, routes, data models, build systems, deployment packaging, repository ownership, project layout, testing, automation, and tooling when that best advances the requested product goal.

Existing source-of-truth documents, registries, route-owner files, manifests, skills, architecture notes, and prior decisions are context about the current or historical state. They should guide understanding but do not block deliberate redesign or migration. Update them when the implementation changes.

## Repository orientation

`AI_CONTEXT.md` contains the repository map, common commands, game ownership information, and an AI-friendly work sequence.

This repository integrates DTF browser games, website game surfaces, supporting tools, educational content, registries, and production publishing for `https://dtfseeds.com`.

Production branch: `main`

Production target: `https://dtfseeds.com`


## Mandatory game location resolution

Before any DTF game code, asset, QA, migration, or release task, read `.agents/skills/dtf-game-location-resolver/SKILL.md` and resolve the game through `data/game-location-registry.json`. Treat that registry as durable project location memory: it distinguishes the production owner from migration copies, prototypes, archived scaffolds, runtime mirrors, asset locations, aliases, and public routes. If records disagree, use `.agents/skills/dtf-game-registry-reconciler/SKILL.md` and update the registries before continuing.

## DTF system orchestration

For broad work spanning several projects, repositories, workers, checks, deployments, or recovery steps, use `.agents/skills/dtf-system-orchestrator/SKILL.md` as the orchestration guide.

Use specialized skills where useful:

- repository/GitHub mechanics: `.agents/skills/github-repo-manager/SKILL.md`
- pull-request semantic review: `.agents/skills/dtf-pr-reviewer/SKILL.md`
- concurrent work: `.agents/skills/dtf-parallel-studio/SKILL.md`
- dtfseeds.com publishing: `.agents/skills/dtfseeds-production-publishing/SKILL.md`
- responsive layout/UI work: `.agents/skills/dtf-responsive-layout/SKILL.md`
- portfolio audits/upgrades: `.agents/skills/dtf-game-portfolio-upgrade/SKILL.md`
- individual game production: `.agents/skills/dtf-game-production/SKILL.md`
- release integration: `.agents/skills/dtf-game-canonical-release/SKILL.md`

These skills describe useful workflows, not immutable implementation boundaries. If a skill encodes a stale project-level restriction, follow `docs/GAME_DEVELOPMENT_FREEDOM.md` and update the skill when practical.

## Development workflow

A strong default sequence is:

1. Inspect current `main`, relevant source, assets, tests, registries, and recent changes enough to understand the existing state.
2. Resolve current ownership and deployment mappings for reference.
3. Use an isolated branch/session when concurrent work could overlap.
4. Make the change needed to achieve the requested result. A full rewrite, migration, backend replacement, engine change, route move, or repository consolidation is allowed when justified.
5. Run tests, builds, browser checks, static checks, route checks, performance checks, or other QA that fit the resulting architecture. For visitor-facing layout/CSS work, read `.agents/skills/dtf-responsive-layout/SKILL.md` first and run `npm run verify:responsive` before release QA.
6. Replace obsolete validators with equivalent or stronger checks when the implementation changes.
7. Update ownership, navigation, documentation, and deployment metadata to match the new reality.
8. Before merging a substantive pull request, review the exact head SHA with `.agents/skills/dtf-pr-reviewer/SKILL.md`; semantic review supplements rather than replaces deterministic checks.
9. Integrate validated work.
10. For production changes, verify the exact visitor-facing route separately before claiming the change is live.

There is no requirement to choose the smallest patch or preserve an existing implementation merely because it already exists.

## Parallel development

Parallel development is allowed. Use separate branches/worktrees when that reduces collisions. `scripts/studio.mjs` and the Parallel Studio skill are useful coordination tools, but project architecture is not locked to them.

Serialize only operations that would write conflicting data to the same production resource at the same time. That serialization is an integrity measure, not a product-development limitation.

## Game portfolio work

When reviewing multiple games, inspect current code and live/public state before ranking or planning them. Existing labels such as prototype, preview, release candidate, canonical, or shipped are status information rather than restrictions on redesign.

Shared systems may be reused, replaced, or rebuilt according to the current product goal. Individual games may be consolidated or separated as needed.

## High Land context

High Land currently lives in `apps/high-land-web` and currently uses the Hostinger PHP Website Room API. Those are current-state facts, not locks.

Current baseline commands include:

```bash
npm ci
npm run test:high-land
npm run build:high-land
node scripts/verify-browser-tool-policy.mjs
```

If High Land is redesigned or migrated, replace stale commands and backend/route assumptions with checks appropriate to the new implementation.

## Repository and production integrity

The freedom policy removes product and implementation restrictions; it does not remove security, privacy, or truthful-release requirements.

- Do not commit or expose credentials, tokens, passwords, private keys, service-role keys, `.env` secrets, or private room/user data.
- Keep authentication, authorization, hidden multiplayer information, and private data protected in whichever architecture is used.
- Avoid irreversible production data loss when a practical backup, migration, or rollback path exists.
- Follow applicable platform, account, legal, and security requirements outside this repository.
- Do not describe a commit, merge, build, package, or upload as live production until the exact public route and expected behavior are verified.

These are integrity requirements, not game-design or engineering locks.
