# High Land Approved HIT Cards

This document locks the approved HIT card intake plan for the browser game.

## Direction

The HIT deck has two separate sources of truth:

- Gameplay source of truth: the 39-card list below and `apps/high-land-web/src/game/data/actionCards.ts`
- Final art source of truth: approved printable/live card art in `apps/high-land-web/public/assets/images/cards/hit/master/`

Do not create a second High Land deck. Do not silently replace the 39-card gameplay list with a new 40-card draft.

## Current production status

The browser game currently has a complete **39-card gameplay deck**.

The committed master artwork is not all final PNG artwork yet:

- Cards `card-001` through `card-031` have committed PNG master art.
- Cards `card-032` through `card-039` currently use committed SVG temporary master art.
- Final production is not fully locked until cards `card-032` through `card-039` are replaced by approved PNG masters or explicitly approved as final SVG art.

This keeps the live game functional while making the remaining art debt visible.

## Required live asset structure

Use this structure going forward:

- `master` = canonical gameplay cards that the live game should load
- `variants` = approved duplicate-title or alternate-art cards that should be archived, not loaded by default

## Canonical master deck

The current approved gameplay deck contains **39 unique cards**.

| ID | Title | Effect text | Current master asset | Source |
|---|---|---|---|---|
| card-001 | Perfect Roll | Move forward 3 spaces. | `card-001-perfect-roll.png` | 1000017859 slot 1 |
| card-002 | Cough Lock | Lose your next turn. | `card-002-cough-lock.png` | 1000017859 slot 2 |
| card-003 | Rosin Rush | Move forward 3 spaces and draw again. | `card-003-rosin-rush.png` | 1000017859 slot 3 |
| card-004 | Lost in Dankwood | Move back to the last green space. | `card-004-lost-in-dankwood.png` | 1000017859 slot 4 |
| card-005 | Munchie Motivation | Move forward 2 spaces. | `card-005-munchie-motivation.png` | 1000017859 slot 5 |
| card-006 | Kief Avalanche | Move back 5 spaces. | `card-006-kief-avalanche.png` | 1000017859 slot 6 |
| card-007 | Trichome Boost | Move to the next purple space. | `card-007-trichome-boost.png` | 1000017859 slot 7 |
| card-008 | Cloud 9 Drift | Move forward 5 spaces. | `card-008-cloud-9-drift.png` | 1000017859 slot 8 |
| card-009 | Smooth Cruise | Move forward 2 spaces. | `card-009-smooth-cruise.png` | 1000017860 slot 1 |
| card-010 | Lucky Lighter | Move forward to the next yellow space. | `card-010-lucky-lighter.png` | 1000017860 slot 2 |
| card-011 | Rolling Hills Shortcut | Move forward 5 spaces. | `card-011-rolling-hills-shortcut.png` | 1000017860 slot 3 |
| card-012 | Dankwood Trail | Move forward to the next green space. | `card-012-dankwood-trail.png` | 1000017860 slot 4 |
| card-013 | Dropped The Lighter | Move back 2 spaces. | `card-013-dropped-the-lighter.png` | 1000017860 slot 5 |
| card-014 | Burnt Snack Run | Move back 4 spaces. | `card-014-burnt-snack-run.png` | 1000017860 slot 6 |
| card-015 | Sticky Fingers | Move back to the last yellow space. | `card-015-sticky-fingers.png` | 1000017860 slot 7 |
| card-016 | Couch Locked | Stay here until your next turn. | `card-016-couch-locked.png` | 1000017860 slot 8 |
| card-017 | Pass The Pack | Switch places with the player behind you. | `card-017-pass-the-pack.png` | 1000017861 slot 1 |
| card-018 | Rotation Rule | Everyone moves forward 1 space. | `card-018-rotation-rule.png` | 1000017861 slot 2 |
| card-019 | Hot Box | Everyone skips their next move except you. | `card-019-hot-box.png` | 1000017861 slot 3 |
| card-020 | Puff Puff Pass | Move forward 2 spaces, then choose one player to move forward 1. | `card-020-puff-puff-pass.png` | 1000017861 slot 4 |
| card-021 | Snack Tax | Every player ahead of you moves back 1 space. | `card-021-snack-tax.png` | 1000017861 slot 5 |
| card-022 | Bogart Alert | The player in first place moves back 3 spaces. | `card-022-bogart-alert.png` | 1000017861 slot 6 |
| card-023 | Reverse Rotation | Turn order reverses for one round. | `card-023-reverse-rotation.png` | 1000017861 slot 7 |
| card-024 | Friend Boost | Choose one player. You both move forward 2 spaces. | `card-024-friend-boost.png` | 1000017861 slot 8 |
| card-025 | Good Vibes Only | Move forward 4 spaces. | `card-025-good-vibes-only.png` | 1000017862 slot 1 |
| card-026 | Rosin Spill | Move back 3 spaces. | `card-026-rosin-spill.png` | 1000017862 slot 2 |
| card-027 | Free Pass | Keep this card. Ignore the next card that makes you move backward. | `card-027-free-pass.png` | 1000017862 slot 7 |
| card-028 | High Roller | Roll again and move that many extra spaces. | `card-028-high-roller.png` | 1000017862 slot 8 |
| card-029 | Rosin Rail Ride | Move forward 6 spaces. | `card-029-rosin-rail-ride.png` | 1000017863 slot 2 |
| card-030 | Munchie Mountain | Move forward 3 spaces, then stop. | `card-030-munchie-mountain.png` | 1000017863 slot 3 |
| card-031 | Kief Cave Slip | Move back 3 spaces and draw again. | `card-031-kief-cave-slip.png` | 1000017863 slot 4 |
| card-032 | Rolling Breeze | Move forward 1 space. | `card-032-rolling-breeze.svg` temporary | 1000017866 slot 1 |
| card-033 | Dankwood Fog | Lose your next turn. | `card-033-dankwood-fog.svg` temporary | 1000017866 slot 2 |
| card-034 | Golden Track | Move forward 4 spaces. | `card-034-golden-track.svg` temporary | 1000017866 slot 3 |
| card-035 | Sugar Crash | Move back 2 spaces. | `card-035-sugar-crash.svg` temporary | 1000017866 slot 4 |
| card-036 | Crystal Tunnel | Move forward 3 spaces. | `card-036-crystal-tunnel.svg` temporary | 1000017866 slot 5 |
| card-037 | Trichome Slide | Move back 5 spaces. | `card-037-trichome-slide.svg` temporary | 1000017866 slot 6 |
| card-038 | Cloud Lift | Move forward 4 spaces. | `card-038-cloud-lift.svg` temporary | 1000017866 slot 7 |
| card-039 | Second Hit | Draw another Hit Card. | `card-039-second-hit.svg` temporary | 1000017866 slot 8 |

## Approved variants to archive

These are approved artworks, but they duplicate a title already represented in the master deck. Archive them as variants and do not load them by default unless art direction changes later.

| Title | Source |
|---|---|
| Pass The Pack | 1000017862 slot 3 |
| Hot Box | 1000017862 slot 4 |
| Snack Tax | 1000017862 slot 5 |
| Bogart Alert | 1000017862 slot 6 |
| Good Vibes Only | 1000017863 slot 1 |
| Pass The Pack | 1000017863 slot 5 |
| Bogart Alert | 1000017863 slot 6 |
| Snack Tax | 1000017863 slot 7 |
| High Roller | 1000017863 slot 8 |

## Repo asset target

Approved master assets should live in:

`apps/high-land-web/public/assets/images/cards/hit/master/`

Variant assets should live in a separate archive folder:

`apps/high-land-web/public/assets/images/cards/hit/variants/`

## Implementation rule

`apps/high-land-web/src/game/data/actionCards.ts` must point at committed master assets. It may point at temporary SVG master assets only for cards that do not yet have approved PNG replacements.

Do not fully declare the live browser game production-ready until the remaining temporary cards are resolved:

- `card-032-rolling-breeze.svg`
- `card-033-dankwood-fog.svg`
- `card-034-golden-track.svg`
- `card-035-sugar-crash.svg`
- `card-036-crystal-tunnel.svg`
- `card-037-trichome-slide.svg`
- `card-038-cloud-lift.svg`
- `card-039-second-hit.svg`

Several approved cards require gameplay mechanics beyond simple movement, including:

- draw another card after moving
- choose one other player
- everyone skips a turn/move except the current player
- reverse turn order
- keep/protect card state

Those mechanics are represented in `actionCards.ts` and resolved through `effectResolver.ts`; tests must stay aligned with the exact card effects above.
