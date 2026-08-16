# DTF / THC Project Source of Truth

Last consolidated: 2026-08-15

## Core rule

Every project has one canonical human/source location and one canonical machine/code location. Chat history, hosted builders, design tools, and generated exports are working surfaces, not the only source of truth.

## Canonical human/source system

Google Drive root:

`DTF Project Asset Library - MASTER SOURCE`

Top-level structure:

```text
00 Admin/
01 Brand/
02 Genetics/
03 Education/
04 Games/
05 Asset Library/
06 Print Production/
07 Websites & Apps/
08 Automation/
09 Archive/
10 Monetization OS/
11 Books and Stories/
```

`07 Websites & Apps` was added during the 2026-08-15 consolidation pass so production websites, app planning, game-hub integration, and deployment material no longer compete with Education or Games folders.

## THC Education

Canonical Drive location:

`03 Education/THC Education System`

```text
00 Project Control/
01 Encyclopedia/
02 Master SOP/
03 Scientific Grow Bible/
04 User Guides/
05 Academy/
06 Visual Education/
07 Research & References/
08 Printables & Downloads/
09 Website Content/
99 Archive/
```

The existing controlled Master SOP folder was moved intact into `02 Master SOP`; its Drive object and internal content were preserved.

## THC Plant Diagnostic

Human/source evidence:

`03 Education/THC Plant Diagnostic Knowledge Base`

Application planning:

`07 Websites & Apps/DTFSeeds Platform/04 Plant Diagnostic App`

Machine/code source:

`dtfgenetics/Thc-dataset`

The diagnostic repo contains its own `docs/SOURCE_OF_TRUTH.md` with the detailed contract.

## DTFSeeds platform

Canonical Drive planning structure:

```text
07 Websites & Apps/
└── DTFSeeds Platform/
    ├── 00 Control/
    ├── 01 Production Site/
    ├── 02 Game Hub/
    ├── 03 THC Education Site/
    ├── 04 Plant Diagnostic App/
    ├── 05 External App Integrations/
    └── 99 Archive/
```

Production code remains in GitHub repositories. Drive stores specifications, controlled references, approved assets, release records, and deployment documentation.

## Games

Canonical human/spec locations are already under:

`04 Games`

Current canonical folders include:

- High Land
- Weedopolis
- High IQ
- Bud or Bluff
- Strain Showdown
- Grower Conversations

Do not create parallel Drive masters for these projects. Library/chat project folders are working rooms only.

High Land already has numbered Rules, Board, Icons, Cards, Audio, Player Tokens, UI, Digital, Print, and Archive areas. Weedopolis already has Rules, Board, Properties, Cards, Digital, Confirmed Assets, and Archive areas. Preserve those structures.

## Tool authority

| Tool / system | Authority |
| --- | --- |
| Google Drive MASTER SOURCE | Canonical human documents, evidence, approved assets, print masters, project controls |
| GitHub | Canonical code, schemas, machine-readable data, tests, build/deployment configuration |
| Codex | Works from GitHub and the source-of-truth docs; changes must be committed and tested |
| Figma | Active design/prototype surface; approved exports return to Drive |
| Base44 / hosted builders | Prototype or deployment surface; never the only copy of code/spec/data |
| ChatGPT Library / project folders | Working material only; approved deliverables must be filed into Drive/GitHub |
| Image generation tools | Production surface; approved masters return to Drive Asset Library/project folder |

## Consolidation rules

1. Inspect before moving.
2. Preserve file IDs and existing controlled folder structures whenever possible.
3. Move project-specific material; do not dismantle shared control registers just to make a folder look cleaner.
4. Do not delete during the first consolidation pass.
5. Compare duplicates by ID/hash, size, version, approval status, and modified date before archiving.
6. Record every significant migration in the DTF Master Project Tracker.
7. GitHub commits must identify source-of-truth or integration changes clearly.
8. Live deployments must be verified separately from repository builds.

## First-pass changes completed

- added `07 Websites & Apps`
- created the canonical THC Education System hierarchy
- moved the existing controlled Master SOP folder into `02 Master SOP`
- created the canonical THC Plant Diagnostic Knowledge Base
- moved diagnostic governance/licensing/registry material out of Drive root into canonical folders
- moved the existing diagnostic dataset pipeline intact into the diagnostic knowledge base
- created the DTFSeeds Platform website/app hierarchy
- moved the existing DTFSeeds folder into the canonical Production Site area
- pushed diagnostic source-of-truth documentation to `dtfgenetics/Thc-dataset`

Further consolidation should continue project-by-project, preserving approved masters and quarantining duplicates before any deletion.
