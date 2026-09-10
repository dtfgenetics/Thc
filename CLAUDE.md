# THC Games Workspace — Agent Context

## Standing unrestricted development policy

Read `docs/GAME_DEVELOPMENT_FREEDOM.md` first for DTFSeeds game work.

There is no temporary hold and no default project-level implementation lock. Older rules such as `locked`, `canonical only`, `preserve existing logic`, `smallest change`, no-rewrite, backend-only, route-only, repository-placement, naming, engine, browser-tool, or QA-tool restrictions are historical guidance and do not block current user-directed work.

Game code, UI, assets, engines, backends, routes, ownership, repository layout, build systems, deployment packaging, tests, and tooling may be changed, replaced, migrated, consolidated, or rebuilt when that better serves the requested result.

Security, privacy, credential handling, truthful live verification, and higher-level platform/legal requirements remain in force because they protect users and production integrity rather than constrain product design.

## Workspace purpose

This repository is the working integration codebase for DTF / THC browser games and the dtfseeds.com game ecosystem.

Current production branch: `main`

Current production site: `https://dtfseeds.com`

Current High Land source location: `apps/high-land-web`

Current High Land multiplayer implementation: Hostinger PHP Website Room API

Those locations and technologies describe the current state; they may be deliberately changed when the product goal calls for a better architecture.

## Development priorities

- Build the strongest version of the requested game or system rather than preserving obsolete implementation choices.
- Inspect existing source and tests enough to understand what is being kept, replaced, or migrated.
- Reuse good systems when useful and remove or replace weak ones when they are not.
- Keep production metadata, navigation, route ownership, and documentation synchronized with the implementation that actually ships.
- Validate material gameplay, networking, storage, rendering, and release changes with tests/checks suited to the resulting architecture.
- Verify visitor-facing production behavior separately from repository/build success.

## High Land current context

Current gameplay goals include multiplayer player naming and invites, accurate dice movement, tokens placed on board spaces, clean board text/icon layout, forward/back action-card logic, and strong movement/board integrity.

Current baseline commands are:

```bash
npm install
npm run test:high-land
npm run build:high-land
```

The current backend is located under:

```txt
apps/high-land-web/public/api/
https://dtfseeds.com/games/high-land/api/
```

That backend is not locked. Supabase, Firebase, another service, or a custom replacement may be adopted when technically justified. Any multiplayer architecture still needs to protect private room state, validate authorization, and keep credentials out of browser code.

## Deployment context

The current High Land build is produced with:

```bash
npm run build:high-land
```

and currently outputs to:

```txt
apps/high-land-web/dist
```

If the build or hosting architecture changes, update these instructions and the deployment system to match rather than preserving an obsolete path.

## Agent working guidance

- Read current source, relevant docs, and recent changes when they help establish reality.
- Use a small patch, large refactor, migration, or complete rebuild according to what best achieves the goal.
- Add or replace tests when materially changing game rules, movement, multiplayer, authorization, persistence, or other critical behavior.
- Project names, domains, routes, brands, architectures, and backends may be changed when the user's current direction requires it.
- Existing DTF / THC branding and game direction are product context, not technical locks.
- Do not expose credentials, tokens, passwords, private keys, `.env` secrets, service-role keys, or private user/room data.
- Do not claim a production change is live until the exact public route and expected behavior are verified.

## Connection map

- GitHub repo: `dtfgenetics/Thc`
- Production branch: `main`
- Production site: `https://dtfseeds.com`
- Current High Land app: `apps/high-land-web`
- Current High Land API: `apps/high-land-web/public/api`
- Current live High Land API: `https://dtfseeds.com/games/high-land/api/`
- Target domains currently in use: `dtfseeds.com`, `dtf420.com`
