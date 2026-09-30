# Repository Architecture

## Role of this repository

`dtfgenetics/Thc` is the production integration and deployment repository for dtfseeds.com. It owns:

- site/deployment orchestration;
- shared production navigation and release contracts;
- monorepo-owned browser games;
- GrowLens integration;
- WordPress/public-route integration;
- synchronized deployment mirrors from canonical product repositories;
- deterministic cross-product QA.

It should not become the canonical authoring home for every DTF/THC product.

## Canonical ownership

| Product domain | Canonical repository | What may exist in `Thc` |
| --- | --- | --- |
| Cultivation tools, Plant Atlas, Terpene Atlas | `dtfgenetics/Tools` | synchronized public-route mirrors, deployment metadata, integration QA |
| THC Encyclopedia and general cultivation education | `dtfgenetics/thc-grow-hub` | publication/integration artifacts and route/runtime integration |
| Certification courses, assessments, practicals, credentials | `dtfgenetics/Thc-learning-courses-` | integration contracts and deployment consumers |
| Grow Doc diagnostic application/data | `dtfgenetics/Thc-dataset` | deployment/runtime integration where required |
| Production integration/site deployment | `dtfgenetics/Thc` | canonical |
| Monorepo-owned browser games | `dtfgenetics/Thc` | canonical |
| Standalone games | repository listed in `data/repository-registry.json` | release contracts/integration artifacts only |

The machine-readable authority is `data/repository-registry.json`.

## Directory intent

- `apps/` — applications canonically owned by this repository.
- `games/` — monorepo-owned games and shared game platform code.
- `site/` — production site integration, WordPress integration, public-route mirrors and deployment assets.
- `scripts/` — executable automation, validators, publishers, release tooling and script-owned machine data only.
- `content/` — integration-side controlled content currently required by production workflows; canonical ownership must still follow the repository registry.
- `data/` — machine-readable registries, release metadata and generated/controlled integration data.
- `docs/` — architecture, operations, migration decisions, historical release notes and human-readable guidance.
- `.github/workflows/` — CI, deployment and maintenance workflows.

## File-boundary rules

Human documentation and one-off release notes belong under `docs/`, not beside executable scripts.

Allowed non-executable files under `scripts/` are limited to data that is consumed by script tooling, such as:

- `scripts/studio/retirements/*.json`;
- archive-local `README.md` files that explain archived executable code.

`npm run verify:repository-file-boundaries` checks:

- package scripts do not reference missing Node/shell/PHP files;
- npm workspace/prefix references resolve;
- CI workflows do not invoke missing `scripts/*` executables;
- stray documentation/release artifacts do not accumulate in `scripts/`;
- known moved artifacts do not return to their old paths.

## Moving code between repositories

Before moving implementation code:

1. identify the product domain;
2. confirm the canonical owner in `data/repository-registry.json`;
3. compare the source with the canonical implementation;
4. move only unique, useful behavior/data/assets;
5. add or update deterministic validation in the canonical owner;
6. keep only the integration contract/mirror needed in `Thc`;
7. remove the duplicate authoring source from `Thc`;
8. update deployment/public-app registries if route ownership changes.

Do not bulk-copy legacy repositories into this repo. Selective migration is required so duplicate source-of-truth implementations do not return.

## Registry separation

- `data/repository-registry.json` tracks repository ownership, migration, legacy review and archive state.
- `site/deployment/public-apps.json` tracks actual public/integration applications and routes.
- Repositories marked `archive_candidate` or `archive_ready` must not be represented as public apps merely to prove they still exist.
- Historical/archive pointers belong in repository/project registries and archive-readiness documentation, not deployment inventory.

## Required checks

For repository cleanup work, run:

```bash
npm run verify:repository-architecture
npm run verify:repository-file-boundaries
npm run verify:cultivation-reference-tools
npm run verify:portfolio
npm run verify:project-os
```

The goal is a small integration repository with explicit ownership, reproducible mirrors, and no ambiguous duplicate authoring source.
