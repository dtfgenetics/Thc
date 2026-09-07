---
name: dtf-game-portfolio-upgrade
description: Portfolio-wide audit and upgrade orchestration for all DTFSeeds games. Use when asked to review every game, identify value-adding fixes/features/tools, prioritize work across the catalog, find shared systems worth building once, or turn game-by-game findings into an implementation roadmap. Resolves canonical ownership before judging a title, scores every game on one rubric, separates blockers from polish, and hands implementation to dtf-game-production plus dtf-game-canonical-release.
compatibility: Works with dtfgenetics/Thc as the portfolio control repo and external canonical game repositories recorded in the source map. Designed for ChatGPT/Codex GitHub connector workflows and local worktrees.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Portfolio Upgrade

Use this skill when the task is larger than one game: audit the catalog, decide what each title needs next, identify shared technology that should be reused across games, or create a prioritized production backlog.

This skill is a planning-and-routing layer. It does **not** replace game-specific implementation skills. Once the next coherent upgrade is chosen, hand that game to `../dtf-game-production/SKILL.md`, then use `../dtf-game-canonical-release/SKILL.md` for packaging, deployment, and evidence.

## Primary outcome

Produce an evidence-backed portfolio roadmap that answers five questions for every game:

1. What is the intended player fantasy and core loop?
2. What actually exists today in canonical source?
3. What blocks production quality or player understanding?
4. What additions create the most player value without duplicating existing systems?
5. Which work belongs to the individual game and which belongs to a shared DTF game platform capability?

The output must be actionable enough that another worker can immediately open the canonical source and implement the next item.

## Mandatory authority resolution

Never audit from memory, the public Game Hub alone, a copied route bundle, or an old project list.

Before scoring a game:

1. Read current `docs/GAME_CANONICAL_SOURCE_MAP.md` and `data/game-source-map.json`.
2. Read `docs/DTF_GAME_SCOPE_MASTER.md` for the current portfolio scope and concept bank.
3. Resolve the canonical repository/path for the title.
4. Read that canonical repo's current README, game manifest, source-of-truth docs, release notes, and obvious open gates.
5. Inspect the actual implementation before calling a feature missing.
6. Treat stale registry/status documentation as a defect to reconcile, not as proof that working code is absent.
7. Do not create a second implementation because a title is missing from one integration repo.

When two sources disagree, prefer the newer explicit canonical source contract and record the drift.

## Portfolio inventory classes

Classify every title into exactly one current class before recommending work:

- `public-production` — public route exists and core game is considered production ready.
- `public-playable` — public playable implementation exists but quality/release gates remain.
- `development-release-candidate` — substantial canonical build exists but central packaging/live verification or final gates remain.
- `browser-vertical-slice` — core deterministic loop exists but content/presentation/release depth is limited.
- `prototype-not-promoted` — playable source exists but public-scope promotion is not approved.
- `concept-only` — no canonical standalone implementation has been established.

Do not equate `preview`, `prototype`, or `vertical slice` with `no code`.

## Per-game audit contract

For each game, record:

- public title and slug;
- canonical repository/path;
- current runtime/engine;
- portfolio class;
- player fantasy;
- primary verbs;
- current core loop;
- target session length if known;
- current progression/replay systems;
- current multiplayer/social systems if any;
- current content scale;
- open release gates documented by canonical source;
- observed source/registry drift;
- highest-value next upgrade;
- shared systems it should adopt;
- work that should explicitly **not** be done yet.

## Ten-dimension quality score

Score each dimension from 0 to 5 using evidence from source, tests, browser evidence, or documented release gates.

1. Gameplay clarity
2. Controls/input quality
3. Responsiveness/feel
4. Visual hierarchy/readability
5. Art/animation quality
6. Sound/feedback quality
7. Content completeness/replay value
8. Accessibility/mobile usability
9. Performance/runtime health
10. Production reliability/release evidence

Use `references/scoring-and-priority.md` for score definitions and prioritization.

Do not award 4 or 5 merely because code exists. Any score below 4 must have a concrete reason.

## Severity before features

Classify findings:

- `P0` — crash, data loss, inaccessible route, security/privacy issue, core loop cannot start/finish.
- `P1` — broken controls, serious mobile failure, soft lock, critical missing asset, unusable multiplayer, severe performance issue.
- `P2` — confusing UX, weak feedback, visual inconsistency, incomplete accessibility, missing noncritical content.
- `P3` — optional polish, extra effects, cosmetic expansion.

Prioritize in this order:

1. P0/P1 production blockers.
2. Canonical ownership/status drift that may send workers to the wrong code.
3. Core-loop depth and clarity.
4. Mobile/accessibility.
5. Content/replayability.
6. Social/multiplayer features where they fit the game fantasy.
7. Art/audio/animation polish.
8. Experimental technology.

Never recommend an engine migration as the first answer to a gameplay or UI problem.

## Value-add test

Every proposed feature must pass at least one of these tests:

- makes the core decision more interesting;
- improves clarity or reduces friction;
- creates meaningful replayability;
- adds progression or mastery;
- enables social/community play appropriate to the title;
- expands validated content without weakening quality;
- improves production reliability, accessibility, or performance;
- creates a reusable platform capability that reduces duplicated engineering across several games.

Reject features that only add dashboard chrome, decorative complexity, duplicated mechanics, or technology with no player-facing benefit.

## Shared-system extraction rule

When three or more games need substantially the same capability, prefer a shared platform system rather than three independent implementations.

Audit against `references/shared-game-systems.md`.

Common extraction candidates include:

- browser QA and screenshot harness;
- input/action mapping;
- audio/settings manager;
- deterministic replay/debug export;
- player profile/achievements/best scores;
- telemetry and balance events;
- content-authoring validators;
- asset manifests/budgets;
- accessibility preferences;
- multiplayer room/invite/reconnect primitives;
- post-deploy live-route verifiers.

A shared system must remain opt-in and game-appropriate. Do not force a shared abstraction onto a title when the integration cost exceeds the repeated code it replaces.

## Replayability analysis

For each game, explicitly evaluate whether replay value comes from one or more of:

- procedural/deterministic seeds;
- daily/weekly challenges;
- mastery or ranking;
- branching choices;
- collection/progression;
- multiplayer/social variance;
- richer content pools;
- difficulty modifiers;
- user-generated or event-host content;
- time/score optimization;
- unlocks/achievements;
- narrative/world progression.

Prefer replay systems that reinforce the existing core loop instead of turning every title into the same meta-game.

## Data/content analysis

For data-driven games, measure content scale and authoring quality.

Check:

- number of questions/cards/cases/decks/levels/encounters;
- duplicate detection;
- schema validation;
- source/provenance requirements where educational claims exist;
- deterministic public/canonical data synchronization;
- difficulty/category distribution;
- whether adding content requires unsafe manual editing;
- whether a dedicated authoring CLI/validator would save repeated work.

Content expansion without validation is not automatically a value add.

## Multiplayer/social analysis

Only propose multiplayer when it strengthens the title.

When multiplayer exists or is proposed, inspect:

- server authority;
- room creation/joining;
- player naming;
- invite links/QR sharing;
- hidden-information privacy;
- reconnect/resume;
- turn/action legality;
- spectator mode if valuable;
- chat/moderation if valuable;
- two-independent-session acceptance tests;
- production persistence and rollback.

Never call multiplayer ready from a single-browser simulation.

## Visual and asset analysis

Ask whether the game looks like the intended fantasy, not merely whether CSS is attractive.

Check:

- immediate focal point;
- playfield obstruction;
- legibility at phone width;
- state/action feedback;
- final vs placeholder art;
- consistent icon/sprite/card/board language;
- animation readability;
- asset provenance;
- asset loading failures;
- source/runtime separation;
- web payload budgets.

Use Blender/GLB only when 3D materially benefits the game. Use existing 2D/browser pipelines when they are the better fit.

## Audio analysis

For every game, decide whether audio is:

- `core-feedback` — actions depend on it or benefit strongly from it;
- `high-value-polish` — materially improves feel but is not required;
- `optional` — low priority for the title.

When audio exists, require browser-safe start behavior, volume/mute control, persistent settings where practical, and no uncontrolled overlap.

## Portfolio roadmap output

For each title, report at minimum:

| Field | Required content |
| --- | --- |
| Status | current portfolio class |
| Blockers | P0/P1 and release gates |
| Core upgrade | single highest-value gameplay/system improvement |
| Secondary additions | up to five meaningful follow-ons |
| Shared systems | reusable DTF systems to adopt |
| Avoid | rewrites/technology/features that should wait |
| Evidence | canonical source path/docs/tests supporting the assessment |

Then produce a portfolio-level priority order with clear reasons.

## Recommended implementation sequence

Default sequence after the audit:

1. Repair canonical ownership/source-map drift.
2. Build the highest-leverage shared QA/debug/settings infrastructure that is already needed by several active titles.
3. Close P0/P1 issues and open release gates on near-finished games.
4. Finish/package development release candidates before starting many new concept titles.
5. Deepen flagship games with meaningful systems/progression.
6. Expand thin vertical slices using data-driven content and replay systems.
7. Add social/competitive layers where they fit.
8. Perform art/audio/animation production passes.
9. Promote concept-bank titles only after mechanics and canonical ownership are locked.

## Handoff to implementation

After selecting a game/task:

1. Start/resume an isolated Studio session using `../dtf-parallel-studio/SKILL.md`.
2. Read `../dtf-game-production/SKILL.md` and the game's own skill/source-of-truth.
3. Make the smallest coherent canonical change.
4. Add regression/data/browser coverage appropriate to the change.
5. Re-score affected dimensions.
6. Use `../dtf-game-canonical-release/SKILL.md` when packaging/live work is requested.
7. Report the exact evidence level achieved rather than saying only `done`.

## Re-audit cadence

Re-run this skill when:

- several games were recently upgraded;
- the Game Hub count or source map changes;
- new development projects are promoted;
- a shared platform system has landed;
- large asset/UI/release work changes relative priorities;
- stale documentation is suspected;
- the user asks what to work on next across the catalog.

Do not preserve an old score or priority merely because it was written previously. Reinspect current canonical source.
