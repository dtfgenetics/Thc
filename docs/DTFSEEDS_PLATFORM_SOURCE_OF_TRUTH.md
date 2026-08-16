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

## Site map

The machine-readable site/deployment map lives in `data/site-registry.json`.

Every production/public route must have:

- URL;
- canonical repository;
- branch;
- build command or build owner;
- output/deployment destination;
- Drive control folder;
- post-deployment verification state.

## Change rule

Do not fix the production site by creating a replacement repository or alternate Drive master unless an explicit migration is approved. Repair the mapped production source first.

## Deployment rule

A successful build is not a successful release. After every production deployment, verify the live route, critical user flow, static assets/base path, browser console, and rollback/source record.

## Current priority

The production site is repaired and stabilized before optional new features are treated as release blockers.
