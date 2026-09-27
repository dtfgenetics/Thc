# THC Tools Repository Split Design

Date: 2026-09-27
Status: Approved design pending implementation plan
Target repository: `dtfgenetics/thc-tools`
Current source repository: `dtfgenetics/Thc`

## Goal

Move the complete DTF / THC cultivation-tool product into a dedicated GitHub repository without changing the existing public URLs on `https://dtfseeds.com` or breaking current tool behavior, shared calculations, GrowLens bridges, navigation, or deployment verification.

## Success criteria

The migration is complete when:

1. `dtfgenetics/thc-tools` is the canonical machine/code source for the THC cultivation-tool suite.
2. Every current production tool route continues to resolve at the same `dtfseeds.com` URL.
3. Shared tool runtime, math, charting, journaling, context, and route-specific dependencies are owned by the new repository.
4. Tool validation and live-verification derive from one canonical registry so route coverage cannot drift.
5. `dtfgenetics/Thc` no longer owns duplicate tool implementation code after the new repository passes build, route, and live verification.
6. Education, Academy, course content, and general site integration remain in the appropriate existing repositories.
7. The migration is staged so removal from `dtfgenetics/Thc` happens only after the new repository proves equivalent behavior.

## Repository boundary

The new repository owns the full cultivation-tool product, not only the `/tools/` launcher.

### Public routes owned by thc-tools

- `/tools/`
- `/atlas/`
- `/terpene-atlas/`
- `/ph-meter/`
- `/tds-meter/`
- `/vpd-chart/`
- `/ppfd-chart/`
- `/water-quality-lab/`
- `/fertigation-lab/`
- `/dryback-lab/`
- `/dew-point/`
- `/environment-control/`
- `/ipm-scout/`
- `/dry-cure-lab/`
- `/grow-planner/`
- `/substrate-calculator/`
- `/breeder-pedigree/`
- `/co2-ventilation/`
- `/photoperiod-planner/`
- `/plant-growth-tracker/`
- `/root-zone-temperature/`
- `/dilution-calculator/`
- `/unit-converter/`

The route list must be generated or validated from one canonical tool registry.

## Shared runtime owned by thc-tools

The migration must include all assets required for standalone tool behavior, including current equivalents of:

- `thc-tool-suite-v1.css`
- `thc-tool-suite-v1.js`
- `thc-cultivation-math-v1.mjs`
- `thc-light-lab-math-v1.mjs`
- `thc-measurement-journal-v1.js`
- `breeder-pedigree-graph-v1.js`
- charting, CSV, graph, and other vendored runtime dependencies used by tool routes
- tool-specific static data required for offline/static route operation
- GrowLens bridge functions used by tool pages
- cultivation context persistence used across compatible tools

## Proposed repository structure

```text
dtfgenetics/thc-tools/
├── apps/
│   ├── tools-hub/
│   ├── atlas/
│   ├── terpene-atlas/
│   ├── ph-meter/
│   ├── tds-meter/
│   ├── vpd-chart/
│   ├── ppfd-chart/
│   └── ...remaining tool routes
├── packages/
│   ├── cultivation-math/
│   ├── cultivation-context/
│   ├── measurement-journal/
│   ├── shared-ui/
│   └── charts/
├── public/
│   └── vendor/
├── data/
│   └── tool-registry.json
├── scripts/
│   ├── build.mjs
│   ├── validate-tools.mjs
│   ├── validate-routes.mjs
│   └── verify-live.mjs
├── tests/
├── docs/
├── package.json
└── README.md
```

The exact internal layout may preserve existing static-route folders initially if that reduces migration risk. Structural cleanup is secondary to achieving a verified repository boundary.

## Canonical registry

Create `data/tool-registry.json` as the single source for:

- tool id
- public slug
- title
- category
- public status
- required shared assets
- required validation markers
- optional GrowLens integration
- live-verification markers

Build-time and validation scripts must consume this registry.

This specifically fixes the existing drift where the current tool-suite validation and live-verification scripts cover different route sets.

## Migration sequence

### Phase 1 — Inventory

Map every current tool route to:

- source files
- shared assets
- imported modules
- data files
- external libraries
- deployment registrations
- navigation registrations
- tests and validators
- GrowLens bridge dependencies

No files are removed from `dtfgenetics/Thc` in this phase.

### Phase 2 — New repository bootstrap

Create `dtfgenetics/thc-tools` with:

- package metadata
- repository instructions
- canonical tool registry
- validation entry points
- copied shared runtime
- copied route implementation code
- deterministic local verification

### Phase 3 — Dependency normalization

Replace hidden cross-repository dependencies with explicit packages or copied canonical runtime owned by `thc-tools`.

No production page may depend on a file that exists only in `dtfgenetics/Thc`.

### Phase 4 — Deployment integration

Update the existing deployment pipeline so the new repository provides the same route payloads to `dtfseeds.com`.

Public paths remain unchanged.

### Phase 5 — Verification

Required gates:

- registry completeness
- all route files present
- all shared runtime assets present
- cultivation math fixture tests
- PPFD / DLI tests
- VPD tests
- pH and TDS conversion tests
- dilution tests
- ventilation tests
- GrowLens bridge contract tests
- responsive/static route validation
- live HTTP 200 verification
- live marker verification
- asset HTTP 200 verification
- no broken references back to removed THC-repo paths

### Phase 6 — Ownership cutover

Only after the new repo passes all gates:

- mark `dtfgenetics/thc-tools` canonical
- update source-of-truth documentation
- update automation references
- remove duplicate tool implementation files from `dtfgenetics/Thc`
- retain only deliberate integration references in `dtfgenetics/Thc`
- run final cross-repository verification

## Deployment contract

The repository split must not change public product URLs. Repository ownership and public URL ownership are separate concerns.

The site must continue serving the same routes under `dtfseeds.com`, regardless of whether deployment is performed by WordPress packaging, Hostinger fallback, static public-suite packaging, or another current production path.

## Rollback

Until final cutover, `dtfgenetics/Thc` remains a complete fallback copy.

If any route, shared asset, bridge, or deployment validation fails after switching the source repository, deployment should revert to the last verified THC-repo source rather than deleting or partially repairing production in place.

## Out of scope

This repository split does not move:

- Academy course content
- encyclopedia content
- certification curriculum
- general WordPress pages
- games
- game assets
- diagnostic model/dataset ownership unless a tool explicitly consumes a published interface
- unrelated site-wide UI code

## Existing issue to fix during migration

Current tool verification has inconsistent coverage:

- the current suite validator explicitly validates 16 newer cultivation routes plus the legacy reference tools;
- the current live verifier covers a different set and omits at least `ipm-scout`, `grow-planner`, and `breeder-pedigree`.

The new registry-driven verification must eliminate separately maintained hard-coded route lists.

## Repository creation constraint

The currently connected GitHub tool can read and write accessible repositories but does not expose a create-repository operation. The empty `dtfgenetics/thc-tools` repository must therefore be created through GitHub or another connected repository-creation surface before files can be committed into it.

No destructive migration should begin before that repository exists.
