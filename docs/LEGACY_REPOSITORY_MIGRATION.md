# Legacy Repository Migration Inventory

Date: 2026-09-28
Source reviewed: `dtfgenetics/dtf-thc-hub`
Target ownership authority: `data/repository-registry.json`

## Purpose

`dtf-thc-hub` is a migration/integration repository, not a canonical authoring source. This inventory identifies the material that must be reconciled before the repository can be frozen or archived.

No directory should be bulk-deleted or blindly copied. For each lane, compare the legacy implementation with the canonical owner, retain unique behavior/assets/provenance, port only what is still useful, and validate the target owner before retiring the legacy copy.

## Migration lanes

| Legacy area | Observed material | Canonical target | Action |
| --- | --- | --- | --- |
| `apps/thc-grow-doc/` and `data/thc-grow-doc/` | Legacy React Grow Doc, diagnostic signals, issue/course data | `dtfgenetics/Thc-dataset` | Diff against current Grow Doc; port only missing UX/logic/data. |
| `packages/project-data/src/growDoctorData.js` | Legacy normalized diagnostic data consumed by the hub | `dtfgenetics/Thc-dataset` | Compare taxonomy/rules with canonical data and retire duplicate runtime source after parity. |
| `data/learning/` | Encyclopedia recovery controls, infographic registry, learning recovery queues/crosswalks | `dtfgenetics/thc-grow-hub` | Reconcile controlled IDs and retain provenance; import only missing records. |
| `content/public/course1-canonical.json` and education UI | Legacy/public course representations and quiz/certificate components | `dtfgenetics/thc-grow-hub` for general education; `dtfgenetics/Thc-learning-courses-` for certification | Separate publication/UI consumers from curriculum authority. Do not migrate legacy certification answers as canonical without course-version checks. |
| `packages/shared-ui/src/high-land/` | Restored legacy High Land implementation/assets | `dtfgenetics/Thc` | Compare with `apps/high-land-web`; retain unique cards, coordinates, audio, rules, or assets only if absent upstream. |
| `packages/shared-ui/src/high-iq/` and `data/high-iq/` | Legacy High IQ engine/question data | `dtfgenetics/Thc` | Compare with canonical High IQ game and question-bank tooling; port unique validated questions/UX only. |
| `apps/dtfseeds/public/weedopolis/` and deploy copies | Integrated Weedopolis bundles | `dtfgenetics/Weedopolis-strain-Edition` plus `Thc` deployment integration | Compare version/behavior with standalone canonical source. Treat built copies as release artifacts, not source. |
| `deploy/dtfseeds-public-html-upload/games/*` | Built/release game bundles including THC U Know and Kush Kings | Individual standalone owners plus `Thc` integration | Use for parity/provenance checks only; do not edit as canonical source. |
| `packages/game-engine/` | Shared game helpers | `dtfgenetics/Thc` | Compare with current shared game platform. Port unique reusable logic or tests, then retire duplicate package. |
| `packages/shared-ui/` | Legacy site shell, game UI, education UI | `dtfgenetics/Thc`, `thc-grow-hub`, or game owner by feature | Split by ownership; never migrate the package wholesale into one target. |
| `packages/project-data/` | Mixed navigation, games, genetics, education, diagnostics | Multiple canonical owners | Decompose by domain; preserve only authoritative or unique records. |
| `deploy/dtfseeds-wordpress/` and deployment scripts | WordPress/static integration and release artifacts | `dtfgenetics/Thc` | Compare with current production deployment/reconciliation logic before moving or retiring. |
| `assets/` | Brand/game/seed/UI assets and recovered media | Owning canonical feature repo or central approved asset lane | Hash/deduplicate, preserve licensing/provenance, and avoid unnecessary binary copies. |
| `docs/education/` and recovery docs | Historical recovery decisions and reconciliation records | `dtfgenetics/thc-grow-hub` docs or archive provenance | Preserve decisions that explain content lineage; do not treat old status as current fact. |

## Required completion conditions before archive

1. Every legacy path is assigned to a canonical owner or marked historical-only.
2. Unique source code, data, assets, licenses, and provenance are migrated or deliberately retained as historical evidence.
3. Production routes no longer require this repository as the only deployment source.
4. Deployment and rollback behavior has parity in `dtfgenetics/Thc`.
5. Games resolve through the current project/deployment registries.
6. Grow Doc resolves to `Thc-dataset` canonical code/data.
7. General education resolves to `thc-grow-hub`; certification resolves to `Thc-learning-courses-`.
8. Built artifacts are reproducible from canonical sources or explicitly retained as historical releases.
9. The repository ownership registry changes `dtf-thc-hub` from `migration` to `archive_candidate`.
10. A final branch/history review confirms no unique work exists outside the default branch.

## Immediate next comparisons

The first code-level comparisons should be:

- Grow Doc: legacy `apps/thc-grow-doc` versus `Thc-dataset/src`.
- High Land: legacy `packages/shared-ui/src/high-land` versus `Thc/apps/high-land-web`.
- High IQ: legacy `packages/shared-ui/src/high-iq` and `data/high-iq` versus `Thc/games/high-iq`.
- Shared game helpers: legacy `packages/game-engine` versus `Thc/games/shared-platform`.
- WordPress/release tooling: legacy `deploy/` and publish scripts versus current `Thc/site` and release scripts.

These comparisons should produce small, reviewable migrations rather than another full-repository copy.


## Comparison decisions completed

### Grow Doc — canonical wins; selective feature migration

Reviewed legacy `dtf-thc-hub/apps/thc-grow-doc` and related `growDoctorData` against `dtfgenetics/Thc-dataset`.

Decision:
- keep `Thc-dataset` canonical;
- do not port the legacy rule engine or duplicate issue dataset;
- canonical already has materially stronger evidence intake, differential logic, investigation history, reference-media controls, diagnostic data quality, and persistence;
- portable case/report export was the useful missing legacy behavior and has been migrated in `dtfgenetics/Thc-dataset` PR #321.

Legacy Grow Doc source should remain read-only migration evidence until PR #321 and any remaining deployment-parity checks land.

### High Land — canonical wins; selective preference migration

Reviewed legacy `packages/shared-ui/src/high-land` against `dtfgenetics/Thc/apps/high-land-web`.

Decision:
- legacy board path has 83 spaces; canonical locked specification has 109 indexes (0–108);
- legacy HIT deck and room helper are superseded by the canonical 40-card system and secure website room transport;
- legacy generated-audio implementation is superseded by file-backed Howler audio;
- persistent audio preference was useful and missing, and has been migrated in `dtfgenetics/Thc` PR #1307;
- do not port the legacy engine, board coordinates, card rules, or local-only room session.

After the preference migration and asset/provenance checks are complete, the legacy High Land implementation can be classified historical-only.

### High IQ — no code migration required

Reviewed legacy `packages/shared-ui/src/high-iq` and `data/high-iq` against `dtfgenetics/Thc/games/high-iq` and the current public runtime.

Decision:
- legacy implementation is a small starter engine/UI and its checked-in `data/high-iq/questions.json` is only a draft placeholder;
- canonical release candidate owns 200 Approved/PASS source-backed questions across 10 domains and 50 registered sources;
- canonical runtime already includes deterministic Daily 10, Balanced/Random Mix, filters, weighted scoring, explanations/context/source links, missed-question review, practice-missed runs, history, personal bests, sharing, keyboard controls, reduced-motion/forced-colors handling, and data-retry diagnostics;
- no unique legacy gameplay capability justifies a port;
- retain legacy High IQ files only for provenance until the parent `dtf-thc-hub` repository is ready for archive.

This lane is complete unless a later asset hash/provenance audit finds a unique approved visual not present in the canonical owner.


### Legacy shared game engine — superseded; no code migration required

Reviewed `dtf-thc-hub/packages/game-engine` against `dtfgenetics/Thc/games/shared-platform`.

Decision:
- the legacy package is not a reusable platform; it is an early High Land-specific prototype with 42 generated spaces, five HIT cards, four fixed players, and basic roll/card state transitions;
- its High Land rules conflict with the current locked High Land specification and therefore must not be reintroduced;
- the canonical shared platform already owns cross-game settings, audio lifecycle, input mapping, deterministic replay/debug export, seeded randomness, loading, validation, accessibility preferences, browser experience helpers, and privacy-safe telemetry buffering;
- no legacy code needs to be ported;
- retain the old package only as historical provenance until `dtf-thc-hub` reaches archive readiness.

This lane is complete.


### WordPress / deployment tooling — canonical deployment stack supersedes legacy hub

Reviewed legacy `dtf-thc-hub/.github/workflows/deploy-dtfseeds.yml`, `scripts/publish-dtfseeds-live.mjs`, and `scripts/dtfseeds-remote-release.sh` against the current `dtfgenetics/Thc` deployment workflows and `scripts/deploy/hostinger-overlay.sh`.

Decision:
- keep `dtfgenetics/Thc` as the deployment authority;
- the newer deployer preserves the legacy safety properties: explicit production confirmation, safe `public_html` root validation, backups outside `public_html`, manifest-driven replacement, rollback, and post-deploy verification;
- the newer deployer additionally validates immutable build artifacts, enforces route ownership boundaries, protects WordPress-/Learning-owned roots from Public Suite mutation, records deployed SHA/scope/backup metadata, and has deterministic activation/rollback tests;
- the WordPress Public Suite path adds serialized transaction locks, stale-transaction recovery, protected rollback/finalization routes, and resource-aware ownership exclusions;
- do not migrate the old release shell scripts or old full-site artifact directories into the canonical repo;
- retain legacy deployment scripts and built artifacts as historical release provenance until `dtf-thc-hub` is archived.

This lane is complete. Production deployments should originate from `dtfgenetics/Thc` only.


### Non-default legacy branches — review required before archive

The `dtf-thc-hub` repository still has a large non-default branch inventory. At least these branches are confirmed ahead of `main`:

- `education-reconciliation` — 2 commits ahead; contains the education canonical-source policy and education control metadata. The useful source policy has been recovered into `dtfgenetics/thc-grow-hub` PR #145.
- `game-studio-v2-isolated-staging` — 4 commits ahead; contains isolated local game-bundle staging with locks/backups.
- `game-ui-playability-polish-20260905` — 9 commits ahead; contains legacy High Land/High IQ/Weedopolis and shared-UI polish.

#### Game staging decision

Do **not** port `scripts/stage-game-bundle.mjs` from the legacy branch into production.

The current canonical `dtfgenetics/Thc` external-game release system is stronger:
- external canonical repositories are represented by explicit contracts;
- registry parity is validated;
- public-suite packaging stages approved external artifacts;
- release pins and live verification exist;
- the development workflow explicitly prohibits hand-copying an external canonical game into the master repo unless ownership is intentionally migrated.

The old staging script's lock/backup behavior is useful historical design evidence but its local-folder copy workflow is superseded by the current external-game contract pipeline.

#### UI polish decision

The legacy UI/playability branch contains polish for obsolete High Land and High IQ implementations. Do not port those components wholesale. Canonical High Land and High IQ have since been rebuilt with stronger gameplay, mobile, accessibility, and release contracts. Any visual idea worth reusing must be evaluated against the current canonical implementation, not copied as code.

Archive remains blocked until all ahead/diverged branches are classified as migrated, superseded, or historical-only.
