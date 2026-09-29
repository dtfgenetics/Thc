# DTF Genetics Repository Map

This document defines the human-readable repository ownership model. The machine-readable authority is `data/repository-registry.json`.

## Canonical product repositories

| Repository | Canonical responsibility | Rule |
| --- | --- | --- |
| `dtfgenetics/Thc` | Production integration, deployment orchestration, and monorepo-owned games | Production integration and release authority. |
| `dtfgenetics/Tools` | Cultivation tools, Plant Atlas, Terpene Atlas, cultivation math, tool runtime | New tool implementation originates here. |
| `dtfgenetics/thc-grow-hub` | THC encyclopedia, general education, education runtime/publications | Certification is not authored here. |
| `dtfgenetics/Thc-learning-courses-` | THC Academy certification, assessments, practicals, credential definitions | Certification source of truth. |
| `dtfgenetics/Thc-dataset` | Grow Doc, diagnostics, diagnostic taxonomy/data, evidence/model-control assets | Diagnostic source of truth. |

## Transitional repositories

### `dtfgenetics/Dtf420`

Controlled future Next.js cutover candidate. It may integrate canonical domains but must not silently become a second source of truth before an explicit route-by-route cutover.

### `dtfgenetics/dtf-thc-hub`

Legacy combined workspace. It still contains unique or older implementations and release material, including game bundles, shared UI, Grow Doc code, education recovery/control data, and WordPress deployment artifacts. It is therefore **migration**, not archive, until unique value is reconciled into canonical owners.

No new canonical tool, education, certification, diagnostic, or game implementation should originate here.

## Standalone game repositories

Standalone games remain authoritative only for the game named in the registry until an explicit migration changes ownership. Migration requires:

1. identify canonical source and latest working behavior;
2. port code/data/assets without losing provenance or licensing information;
3. pass the target `Thc` game architecture and deterministic QA gates;
4. update the repository registry and public deployment registry;
5. only then freeze/archive the former standalone owner.

## Legacy repository lifecycle

Statuses are intentionally fail-safe:

- `legacy_review`: inspect for unique reusable code/content before archive.
- `archive_candidate`: no known active ownership; still verify branches/history before archive.
- Nothing is archived merely because another repository looks newer.

## Coding rule

Before editing a feature, resolve its canonical repository in `data/repository-registry.json`. Integration mirrors and deploy artifacts are outputs/consumers, not competing authoring sources.

If a proposed change would introduce a second canonical implementation of a domain, stop and move the change to the declared owner or update the architecture through an explicit migration.
