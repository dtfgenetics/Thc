# DTF Master Project Tracker — Sanitized Routing Snapshot

- Drive source ID: `1MLhwAmhrJjDT7kGKsIrlv3AD5G8qBkURGyhhJpUozqI`
- Drive title: `DTF Master Project Tracker`
- Snapshot/migration date: 2026-08-18
- Public-safe mirror only. Operational credentials, environment values, keys, and private business data are intentionally excluded.

## Authority rule

This snapshot preserves Drive routing and consolidation history. Current executable project status in GitHub is controlled by `data/project-registry.json`, `data/site-registry.json`, `data/asset-manifest.json`, project source-of-truth files, tests, and deployment manifests. Historical tracker rows must not override newer verified GitHub state.

## Main controlled project routing from Drive

| Project | Canonical code/data repository | Drive destination / human-readable control |
|---|---|---|
| DTFSeeds Platform + High Land | `dtfgenetics/Thc` | `07 Websites & Apps/DTFSeeds Platform` + `04 Games/High Land` |
| THC Plant Diagnostic | `dtfgenetics/Thc-dataset` | `03 Education/THC Plant Diagnostic Knowledge Base` + DTFSeeds diagnostic app area |
| THC Education System / Grow Hub | `dtfgenetics/thc-grow-hub` | `03 Education/THC Education System` |
| Weedopolis | `dtfgenetics/Weedopolis-strain-Edition` | `04 Games/Weedopolis` |
| THC U Know | `dtfgenetics/thc-u-know-card-game-` | `04 Games/THC U Know` |
| THC Crossword | `dtfgenetics/Thc-crossword-` | `04 Games/THC Crossword` |
| THC Chess / Kush Kings Chess | `dtfgenetics/Thc-chess-git` | `04 Games/THC Chess` |
| Who Took It? / THC Guess Who | `dtfgenetics/Thc-guess-who` | `04 Games/THC Guess Who` |
| Happy Seed Stories / Seed Valley | `dtfgenetics/Happy-seed-story-s-` | `11 Books and Stories/Happy Seed Stories - Seed Valley` |
| THC Content Engine | `dtfgenetics/Video-photo-editing-and-communications-posting-` | `08 Automation/THC Content Engine` |
| Terpocalypse | `dtfgenetics/Terpocalapse` | `04 Games/Terpocalapse` |
| PhenoQuest / Catching Phenos | `dtfgenetics/Catching-phenos` | `04 Games/Catching Phenos` |

## Placeholder / consolidation routing preserved from Drive

- `dtfgenetics/all-in-one-thc-grow-` — merge-candidate/legacy placeholder; do not treat as the authoritative Grow Hub.
- `dtfgenetics/Thc-rpg` — placeholder until executable canonical implementation exists.
- `dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple` — placeholder until executable canonical implementation exists.

## Verified consolidation milestones recorded by the tracker

- 2026-08-15: Drive/GitHub consolidation pass established website/app, education, diagnostic, game, and content-engine destinations without deleting user content.
- 2026-08-15: all accessible repositories were classified by canonical/preproduction/prototype/placeholder/merge-candidate role.
- 2026-08-15: machine project/site/asset registries and source-of-truth documentation were created and portfolio validation passed.
- 2026-08-16: unique Library material was promoted to canonical Drive destinations in controlled batches, with duplicate/quarantine handling instead of blind deletion.
- 2026-08-18: Drive-backed genetics line sheets and project-control indexes began being mirrored into their exact GitHub repositories with provenance.

## Migration rules carried forward

1. Drive owns human-readable controlled documents, approved source assets, research, print masters, playtest/release evidence, and large binaries.
2. GitHub owns executable code, machine-readable data, tests, schemas, build/deployment configuration, and source-controlled integration records.
3. Library/builders are working surfaces, not the only archive.
4. Do not blindly bulk-copy old folders; identify, route, preserve provenance, and quarantine ambiguous/superseded material.
5. Do not put secrets, private inventory, customer data, private business records, service-role keys, or credentials in public repositories.
6. When Drive and GitHub status disagree, verify the newer executable/source-control evidence before changing the canonical registry.
