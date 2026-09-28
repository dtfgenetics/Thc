# DTF Game Registry v2 and Mandatory Game Development Skill

Date: 2026-09-28  
Status: Approved design captured for implementation planning  
Repository: `dtfgenetics/Thc`

## Problem

DTF game work currently depends on multiple overlapping sources of truth:

- `data/game-location-registry.json`
- `data/game-source-map.json`
- `data/project-registry.json`
- `docs/GAME_CANONICAL_SOURCE_MAP.md`
- `docs/DTF_GAME_SCOPE_MASTER.md`
- deployment registries
- game-specific source-of-truth docs
- migration/prototype copies in `dtfgenetics/Dtf420`
- standalone game repositories

These records have drifted over time. The same game can have multiple names, multiple copies, different deployment paths, and stale status language. This creates repeated errors: repairing the wrong copy, confusing migration code with production, losing track of active prototypes, and making inconsistent live-status claims.

The system needs one machine-readable authority that answers, for every tracked game: what it is, where it lives, how it works, how it ships, and what state it is in.

## Goal

Create one durable game operating system for the DTF portfolio.

Future game work must resolve the requested game through the canonical registry before implementation. The registry must define identity, product goal, architecture, ownership, source paths, runtime, deployment, testing, assets, status, and next milestone. Human-readable portfolio documents must be generated from that registry wherever practical.

The system must cover all currently tracked games plus future concepts when they enter development.

## Non-goals

- Do not force all games into one repository.
- Do not require every game to use the same engine or networking stack.
- Do not lock architecture permanently. `docs/GAME_DEVELOPMENT_FREEDOM.md` remains authoritative: ownership, routes, engines, repositories, and architecture may change when that serves the product goal.
- Do not claim a game is public merely because it exists in the registry.
- Do not duplicate large game design documents inside JSON.

## Canonical authority

Create:

`data/game-registry-v2.json`

This file becomes the canonical portfolio authority for game identity, location, architecture summary, integration, status, verification, and references.

The existing `data/game-location-registry.json` remains temporarily supported during migration, then becomes either generated compatibility output or is retired once all validators and automation consume v2.

## Required registry schema

Top-level fields:

- `schemaVersion`
- `updated`
- `authority`
- `statusDefinitions`
- `aliasMap`
- `games`
- `concepts`

Each `games[]` entry must contain:

### Identity

- `id` — canonical stable machine ID
- `title`
- `aliases[]`
- `formerNames[]`
- `relatedGameIds[]` where distinct games are commonly confused
- `legacyIds[]` where an old machine identity must be preserved for compatibility

### Product definition

- `goal.summary`
- `goal.playerFantasy`
- `goal.primaryVerbs[]`
- `goal.coreLoop`
- `goal.winCondition`
- `goal.lossCondition`
- `goal.sessionLength`
- `genre[]`
- `players.mode`
- `players.min`
- `players.max`
- `audience`
- `gameDesignDoc` — path or repo-qualified path to the larger game contract

### Canonical ownership

- `production.repository`
- `production.defaultBranch`
- `production.sourcePaths[]`
- `production.sourceOfTruth`
- `production.integrationRepository`
- `production.integrationPath`
- `production.integrationMode`
- `production.runtimePath`
- `publicRoute`
- `productionHost`
- `apiOrigins[]` where applicable

### Architecture

- `architecture.renderer`
- `architecture.frameworks[]`
- `architecture.simulationOwner`
- `architecture.uiLayer`
- `architecture.networkModel`
- `architecture.multiplayerAuthority`
- `architecture.persistence`
- `architecture.saveVersion`
- `architecture.inputModes[]`
- `architecture.mobileContract`
- `architecture.accessibilityContract`
- `architecture.audioSystem`
- `architecture.assetManifest`
- `architecture.sharedSystems[]`

The normal preferred boundary is:

- simulation owns game rules/state;
- renderer owns presentation/animation/camera;
- DOM owns text-heavy HUD, menus, settings, and accessibility-sensitive UI;
- networking transmits validated actions/state;
- persistence stores serializable simulation state rather than renderer objects.

Games may intentionally differ, but the registry must state the actual boundary.

### Major systems

`systems[]` records the game-specific systems that define the product, such as:

- levels/worlds
- scoring
- progression
- AI
- deck/card rules
- board rules
- economy
- combat
- matchmaking
- lobbies
- spectators
- chat
- replay
- achievements
- diagnostics/education mechanics

This is a compact index, not a replacement for the full `GAME.md`.

### Assets

- `assets.registryId`
- `assets.repoRoots[]`
- `assets.driveRefs[]` where applicable
- `assets.licensePolicy`
- `assets.artDirectionDoc`
- `assets.audioRoot`

Third-party code and assets remain subject to their own licenses. The registry records where license notices are maintained.

### Build, test, and release

- `verification.buildCommand`
- `verification.testCommands[]`
- `verification.registryChecks[]`
- `verification.browserQa`
- `verification.liveCheck`
- `release.status`
- `release.lastVerifiedRevision`
- `release.lastVerifiedAt`
- `release.lastVerifiedUrl`
- `release.blockers[]`
- `release.nextMilestone`

Allowed release states are explicit and ordered:

`concept -> design -> prototype -> vertical-slice -> playable-local -> release-candidate -> packaged -> public-unverified -> public-verified`

A game may also be `archived`, `superseded`, or `compatibility-only`.

Only `public-verified` may be represented as confirmed live in generated portfolio output.

### Development and deprecated copies

- `developmentLocations[]`
- `deprecatedLocations[]`

Every alternate copy includes:

- repository
- paths
- role
- relation to canonical source
- whether edits are allowed
- whether it may be released
- notes

This is required for known ambiguity such as:

- Burn Buds vs Cannabis Fleet Battle vs Dtf420 Burn Buds
- Seed Man vs Seed Ascent
- Terpocalypse V1 vs V2
- Dtf420 migration implementations vs canonical production owners

### Quality target

- `quality.competitiveBenchmarks[]`
- `quality.targetExperience`
- `quality.knownGaps[]`

This makes the product goal explicit without hard-coding one engine or implementation.

## Game contract documents

Substantial games should have a concise game contract:

- local games: `games/<id>/GAME.md` or an existing stronger source-of-truth document
- standalone repos: `docs/GAME.md` or the repo's existing source-of-truth document

The registry answers: **where is it and what state is it in?**

The game contract answers: **what are we building and how should it play?**

A game contract should define:

- fantasy and player experience
- rules
- core loop
- session structure
- progression
- major systems
- content scope
- UX expectations
- controls
- visual/audio direction
- multiplayer behavior
- completion criteria
- current known gaps

Existing source-of-truth documents may fulfill this role if they contain equivalent information. Do not create redundant files solely to meet a naming convention.

## Generated documentation

The following should be generated from v2 where practical:

- `docs/GAME_CANONICAL_SOURCE_MAP.md`
- portfolio/status tables in `docs/DTF_GAME_SCOPE_MASTER.md`
- ownership/location summaries
- release-status summaries

Generated sections must include a marker indicating they are generated and must not be manually edited.

Free-form product policy and historical explanation may remain hand-maintained outside generated regions.

## Cross-registry reconciliation

The v2 validator must reconcile, not blindly overwrite, related systems:

- `data/project-registry.json`
- `site/deployment/public-apps.json`
- `data/public-navigation.json`
- `data/game-asset-production-registry.json`
- external release pin files
- standalone integration manifests

The registry is authoritative for game identity/ownership/status. Specialized registries remain authoritative for their domain-specific details but must agree on shared fields such as IDs, repos, routes, and public status.

## Validator

Add:

`scripts/validate-game-registry-v2.mjs`

Package command:

`npm run games:registry:check`

The validator must fail when:

1. canonical IDs are duplicated;
2. aliases resolve to more than one game;
3. two active games claim the same public route;
4. a required canonical repository/source path is absent from the record;
5. an entry lacks product goal information;
6. a game marked public is absent from deployment/navigation registration;
7. a public navigation/deployment game is missing from v2;
8. a migration/prototype location is also represented as production without an explicit cutover relationship;
9. a deprecated location is marked releaseable;
10. required build/test/live-verification fields are missing for the stated release status;
11. a `public-verified` game lacks exact URL, revision, and verification timestamp;
12. a standalone pinned revision disagrees with its DTFSeeds integration pin;
13. generated docs are stale;
14. known compatibility aliases such as Burn Buds / protect-the-plants resolve incorrectly;
15. Seed Man and Seed Ascent collapse into one identity;
16. concept entries are presented as implemented games.

The existing `games:locations:check` command remains during migration and should eventually delegate to or run alongside the v2 validator.

## Generated-doc tool

Add:

`scripts/generate-game-registry-docs.mjs`

Commands:

- `npm run games:registry:docs`
- `npm run games:registry:docs:check`

The check command must compare generated output without rewriting files and fail CI when docs are stale.

## Mandatory DTF game-development skill

Create:

`.agents/skills/dtf-game-development/SKILL.md`

Trigger:

Use for every DTF game request involving research, planning, code, assets, debugging, UI/UX, multiplayer, testing, deployment, migration, source-location questions, or competitive improvement.

Mandatory first step:

1. read `data/game-registry-v2.json`;
2. resolve the user's game name through the alias map;
3. establish the exact canonical game entry;
4. read its game contract/source-of-truth document;
5. inspect the canonical repository/path before proposing or applying changes;
6. identify alternate/migration/deprecated copies;
7. establish the current release state and next milestone;
8. then invoke the appropriate Game Studio / engineering skill.

The skill must require this internal preflight before implementation:

- canonical game ID
- title and aliases
- player/product goal
- canonical repo
- source paths
- runtime/integration paths
- public route
- architecture
- alternate copies
- asset location
- test/build commands
- release state
- known blockers
- next milestone

If any material conflict exists, resolve the registry or source-of-truth conflict before editing gameplay code.

The skill must also state:

- never infer authority from folder name;
- never call a game live based on a commit/build alone;
- do not repair deployed/copied output when a canonical source exists;
- when deliberately changing ownership/route/architecture, update v2 in the same change;
- development freedom remains intact: the registry describes current reality and is updated when reality changes.

## Existing location resolver

`.agents/skills/dtf-game-location-resolver/SKILL.md` should become a thin compatibility wrapper that directs future agents to `dtf-game-development`, or be retired after all references are migrated.

Do not maintain two independent rule sets.

## Skill verification

Because this is a behavior-shaping skill, test it against failure scenarios before treating it as complete.

Baseline scenarios should include:

1. User says "fix Burn Buds" while copies exist in `Thc` and `Dtf420`.
2. User says "continue Seed Man" with Seed Ascent also present.
3. User says "fix Terpocalypse V2" while V1 is production.
4. User asks to make Kush Kings live while frontend/backend/integration status differ.
5. User asks to improve a game using a same-named deployed HTML snapshot instead of canonical source.

Success means the agent resolves the intended identity/owner/status from the registry before editing.

## Portfolio coverage

Migration must include every current entry from `data/game-location-registry.json`, including currently non-public projects such as:

- Seed Ascent
- Stoner Duck Race
- Root Cause
- THC U Know
- Kush Kings
- Ganjumanji
- THC RPG

It must also preserve the current public catalog and standalone owners.

The future concept bank should live under `concepts[]`, not `games[]`, until implementation begins. When a concept enters development, it is promoted into `games[]` with a canonical ID, owner, and initial contract.

## Migration strategy

Phase 1 — establish v2 without breaking existing automation:

1. create v2 schema and populate all current tracked games;
2. add validator;
3. add generator/checker;
4. add mandatory skill;
5. retain v1 location registry.

Phase 2 — reconcile and generate:

1. compare v2 against location, source-map, project, navigation, deployment, and asset registries;
2. repair conflicts;
3. generate human-readable source/status tables from v2;
4. update CI/preflight to require v2 checks.

Phase 3 — remove duplicated authority:

1. convert old location/source-map files to generated compatibility outputs or retire them;
2. migrate scripts to consume v2;
3. make `dtf-game-location-resolver` a compatibility wrapper or remove it after references are migrated.

## CI integration

After migration is green, `games:preflight` and `verify:project-os` must include:

- `games:registry:check`
- `games:registry:docs:check`

A registry or generated-doc drift failure blocks release.

## Definition of done

This architecture is complete when:

- every tracked game resolves to one canonical entry;
- aliases cannot resolve ambiguously;
- all production owners/routes are explicit;
- every active game has a product goal and game-contract reference;
- migration/deprecated copies are explicitly labeled;
- all public-state claims are backed by exact live verification metadata;
- generated docs agree with the registry;
- portfolio/deployment/navigation registries reconcile;
- the mandatory DTF game-development skill is installed and tested;
- game work starts from the registry in future sessions;
- CI prevents source-of-truth drift from returning.
