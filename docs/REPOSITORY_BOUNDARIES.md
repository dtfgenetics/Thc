# Repository Boundaries

DTF/THC uses one canonical repository per product domain.

`dtfgenetics/Thc` is the production integration, packaging, verification, and deployment repository. It may contain generated or synchronized deployment mirrors, adapters, route metadata, tests, and release automation for externally owned products, but those mirrors are not authoring sources.

## Canonical ownership

| Domain | Canonical repository | Role of `dtfgenetics/Thc` |
| --- | --- | --- |
| Cultivation tools, Plant Atlas, Terpene Atlas | `dtfgenetics/Tools` | integration/deployment mirror |
| THC education / encyclopedia / non-certification learning | `dtfgenetics/thc-grow-hub` | publication adapter |
| THC Academy certification curriculum and assessments | `dtfgenetics/Thc-learning-courses-` | publication adapter |
| Grow Doc / diagnostics / diagnostic datasets and evaluation | `dtfgenetics/Thc-dataset` | integration adapter |
| Monorepo-owned games | `dtfgenetics/Thc` | canonical owner |
| Standalone games | their registered standalone repository | integration/deployment mirror |

Machine-readable ownership lives in `data/repository-boundaries.json`.

## Transitional repositories

### `dtfgenetics/Dtf420`
Future-cutover/merge candidate. Do not create new canonical product implementations here. Unique improvements must be ported to the owning canonical repository.

### `dtfgenetics/dtf-thc-hub`
Archive candidate. Audit for unique source/assets, migrate unique value, then archive.

## Immediate archive candidates

- `dtfgenetics/code` — empty.
- `dtfgenetics/all-in-one-thc-grow-` — legacy placeholder/merge candidate.
- `dtfgenetics/thc-music-bot-for-discod` — duplicate bot repository.

## Rules

1. A product domain has one authoring source.
2. Public-route copies in `Thc` are release artifacts or integration mirrors, never competing sources.
3. Fixes are made in the canonical repository first and synchronized into `Thc`.
4. Do not back-sync mirror changes over canonical repositories.
5. Do not add a second implementation of a canonical external product without an explicit migration plan.
6. Archive completed one-off migration scripts and obsolete workflows.
7. Every active project must have a source-of-truth entry in the project registry or repository-boundary registry.
