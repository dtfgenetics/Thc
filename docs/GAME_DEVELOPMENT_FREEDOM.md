# DTF Game Development Freedom Policy

Status: **STANDING**
Effective: 2026-09-09
Authority: explicit user direction

## Policy

All repository-imposed product and game-development restrictions are removed.

For DTFSeeds games and game-adjacent runtimes, prior language such as `locked`, `canonical only`, `preserve existing logic`, `smallest change`, `do not rewrite`, `do not change the backend`, `do not change the route`, `do not rename`, `do not restructure`, architecture locks, repository-placement locks, engine locks, ownership locks, and development/QA-tool prohibitions is advisory historical context rather than a blocker.

The current user-directed product goal takes precedence over stale implementation constraints. Developers and agents may change whatever project-level implementation choices are needed to reach that goal.

## What may change

Any game may be modified, replaced, redesigned, rewritten, migrated, consolidated, split, or rebuilt from scratch when that is the better engineering or product choice.

This includes, without limitation:

- gameplay rules and systems;
- UI, UX, accessibility, controls, and input;
- character, world, animation, audio, VFX, and other assets;
- rendering engines and runtime architecture;
- multiplayer backends, APIs, networking, persistence, and data models;
- public routes, build output, deployment packaging, and hosting integration;
- repository ownership, folder layout, source-of-truth placement, and project boundaries;
- build systems, test systems, browser tooling, QA tooling, automation, and CI;
- names, labels, product structure, and navigation when the current goal requires it.

Existing source maps, architecture documents, route owners, registries, manifests, and project-specific specifications describe the current or historical state. They do not prohibit deliberate replacement or migration. When implementation changes, update those records to reflect the new reality.

## Working principle

Use the strongest practical solution, not the smallest permitted patch. Reuse existing systems when they are useful; replace them when they are not. Do not preserve obsolete code, architecture, or process solely because an older document called it canonical or locked.

Tests and release checks are evidence systems, not design locks. If the architecture changes, update obsolete tests and validators to equivalent or stronger checks that represent the new product.

## Non-product integrity requirements

This policy removes project-development restrictions. It does not remove requirements that protect users, accounts, production data, or the truthfulness of release claims.

- Do not expose or commit credentials, tokens, passwords, private keys, service-role keys, `.env` secrets, or private multiplayer data.
- Protect authentication, authorization, hidden multiplayer state, and private user data in whichever architecture is used.
- Avoid irreversible production data loss when a practical backup, migration, or rollback path exists.
- Follow applicable platform, account, legal, and security requirements outside this repository.
- Do not claim a change is live merely because code was committed, merged, built, or uploaded; verify the exact visitor-facing production route and expected behavior first.

These are integrity requirements, not product-design or implementation locks.

## Scope

This standing policy applies to every DTFSeeds game, game-adjacent runtime, current project, future game, and related game-development workflow unless the user gives a newer explicit direction for a specific task.
