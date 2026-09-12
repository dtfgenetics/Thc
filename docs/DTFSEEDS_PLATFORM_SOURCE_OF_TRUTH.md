# DTFSeeds Platform — Source of Truth

## Platform ownership

Google Drive `07 Websites & Apps/DTFSeeds Platform` is the canonical human-control location for the production website, game hub, THC education-site planning, plant-diagnostic app planning/integration contracts, external-app integration records, and platform archives.

GitHub repositories are canonical for their code/data scope:

- `dtfgenetics/Thc` — shared DTFSeeds integration, High Land, GrowLens, WordPress/public-content and deployment automation.
- `dtfgenetics/Thc-dataset` — THC Grow Doc diagnostic app and machine-readable diagnostic data.
- `dtfgenetics/Weedopolis-strain-Edition` — Weedopolis.
- `dtfgenetics/thc-u-know-card-game-` — THC U Know.
- `dtfgenetics/Thc-crossword-` — weekly crossword.
- `dtfgenetics/Thc-chess-git` — Kush Kings Chess.
- Other project repositories are mapped in `data/project-registry.json`.

ChatGPT Library is a working surface only. Base44, Figma, ChatGPT Sites and similar builders are build/design surfaces, not the master archive.

## Site map and information architecture

The machine-readable site/deployment map lives in `data/site-registry.json`.

Visitor-facing navigation and section groupings live in `data/public-navigation.json`.

The human-readable arrangement contract lives in `docs/DTFSEEDS_INFORMATION_ARCHITECTURE.md`. The primary site roots are locked to Home, Seeds, Learn, Courses, Diagnostic, Games, Community, and Shop in that order. The navigation registry and site registry are validated against one another so they cannot silently describe different site structures.

Every production/public route must have:

- URL;
- canonical repository;
- branch;
- build command or build owner;
- output/deployment destination;
- Drive control folder;
- post-deployment verification state.

Every visitor-facing page must also have one primary information-architecture root and one authoritative production writer. Cross-linking is allowed; competing route ownership is not.

## Change rule

Do not fix the production site by creating a replacement repository or alternate Drive master unless an explicit migration is approved. Repair the mapped production source first.

When content is duplicated or arranged under the wrong section, reconcile the useful material before redirecting or archiving the old route. Use the `KEEP`, `MOVE`, `MERGE`, `REDIRECT`, `ARCHIVE`, and `FIX` dispositions defined in `docs/DTFSEEDS_INFORMATION_ARCHITECTURE.md`.

## Deployment rule

A successful build is not a successful release. After every production deployment, verify the live route, critical user flow, static assets/base path, browser console, and rollback/source record.

## Current priority

The production site is repaired, structurally reconciled, and stabilized before optional new features are treated as release blockers. Current work prioritizes canonical navigation, route ownership, content arrangement, broken/missing public routes and assets, and live verification across the full site inventory.
