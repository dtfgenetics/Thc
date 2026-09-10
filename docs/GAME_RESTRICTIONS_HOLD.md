# Temporary Game Development Restriction Hold

Status: **ACTIVE**
Effective: 2026-09-09
Authority: explicit user direction
Duration: remains active until the user explicitly revokes or replaces it.

## Purpose

All DTFSeeds project-imposed development restrictions that would prevent necessary changes to a game are temporarily suspended. Agents and developers may modify, replace, restructure, migrate, rewrite, consolidate, or remove game code, assets, rendering, UI, architecture, data plumbing, build tooling, deployment packaging, multiplayer implementation, routes, and repository layout when doing so is reasonably necessary to achieve the requested product goal.

## Scope

This hold applies to every DTFSeeds game and game-adjacent runtime, including High Land, Weedopolis, Seed Man Run, High IQ, High Life, Who Took It, Terpocalypse, Strain Showdown, PhenoQuest, Burn Buds / Protect the Plants, THC U Know, Kush Kings Chess, Crossword, Grower Conversations, Strain Match, Grow Room Bingo, Lost in the Terps, Mystery Strain, Spin the Strain, Grow Room Defense, Harvest Hustle, Trichome Trials, Pheno Draft, High Lines, Ganjumanji, THC RPG, Root Cause, and future game projects.

## Temporary override

While this hold is active:

- Existing project-level instructions such as "preserve existing logic," "make the smallest change," "do not create a competing implementation," "do not change the backend," "do not rename or restructure," "locked," "canonical only," or similar game-development constraints are not blockers when they conflict with the current user-directed work.
- Canonical/source-of-truth files remain useful historical and integration references, but they do not prohibit replacing or migrating the implementation.
- A game may be rebuilt from scratch when that is cleaner than incremental repair.
- Existing engines, APIs, networking, persistence, build systems, or renderers may be replaced when technically justified.
- Game files may be moved, consolidated, deleted, or split when required by the new architecture.
- Public routes and deployment packaging may be changed when needed, provided the resulting production route is verified before claiming it is live.
- High Land and Weedopolis are not technically locked against code changes; prior product preferences about preserving their current visual direction remain product guidance unless the user changes that direction.
- Development may span multiple game repositories and the integration repository when needed to complete the goal.

## Requirements that are not suspended

This file cannot override platform, legal, security, or account-level requirements. In particular:

- Never expose or commit credentials, tokens, passwords, private keys, service-role keys, private room data, or `.env` secrets.
- Do not falsely claim a deployment or production change is live without verifying the exact visitor-facing route.
- Avoid destructive data loss when a reversible migration or backup is reasonably available.
- Follow any higher-level system or platform safety requirements that are outside this repository.

These are safety/integrity requirements, not product-development limitations.

## Revocation

The hold ends only when the user explicitly says to restore, re-enable, or replace the project restrictions. At that point, update this file to `Status: INACTIVE` and restore whichever constraints the user requests.
