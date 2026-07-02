# High Land Approved HIT Cards

This document locks the approved HIT card art intake plan for the browser game.

## Direction

Approved art is the source of truth.

Use this structure going forward:

- `master` = canonical gameplay cards that the live game should load
- `variants` = approved duplicate-title or alternate-art cards that should be archived, not loaded by default

## Canonical master deck

The current approved master deck contains **39 unique cards**.

| ID | Title | Effect text | Source |
|---|---|---|---|
| card-001 | Perfect Roll | Move forward 3 spaces. | 1000017859 slot 1 |
| card-002 | Cough Lock | Lose your next turn. | 1000017859 slot 2 |
| card-003 | Rosin Rush | Move forward 3 spaces and draw again. | 1000017859 slot 3 |
| card-004 | Lost in Dankwood | Move back to the last green space. | 1000017859 slot 4 |
| card-005 | Munchie Motivation | Move forward 2 spaces. | 1000017859 slot 5 |
| card-006 | Kief Avalanche | Move back 5 spaces. | 1000017859 slot 6 |
| card-007 | Trichome Boost | Move to the next purple space. | 1000017859 slot 7 |
| card-008 | Cloud 9 Drift | Move forward 5 spaces. | 1000017859 slot 8 |
| card-009 | Smooth Cruise | Move forward 2 spaces. | 1000017860 slot 1 |
| card-010 | Lucky Lighter | Move forward to the next yellow space. | 1000017860 slot 2 |
| card-011 | Rolling Hills Shortcut | Move forward 5 spaces. | 1000017860 slot 3 |
| card-012 | Dankwood Trail | Move forward to the next green space. | 1000017860 slot 4 |
| card-013 | Dropped The Lighter | Move back 2 spaces. | 1000017860 slot 5 |
| card-014 | Burnt Snack Run | Move back 4 spaces. | 1000017860 slot 6 |
| card-015 | Sticky Fingers | Move back to the last yellow space. | 1000017860 slot 7 |
| card-016 | Couch Locked | Stay here until your next turn. | 1000017860 slot 8 |
| card-017 | Pass The Pack | Switch places with the player behind you. | 1000017861 slot 1 |
| card-018 | Rotation Rule | Everyone moves forward 1 space. | 1000017861 slot 2 |
| card-019 | Hot Box | Everyone skips their next move except you. | 1000017861 slot 3 |
| card-020 | Puff Puff Pass | Move forward 2 spaces, then choose one player to move forward 1. | 1000017861 slot 4 |
| card-021 | Snack Tax | Every player ahead of you moves back 1 space. | 1000017861 slot 5 |
| card-022 | Bogart Alert | The player in first place moves back 3 spaces. | 1000017861 slot 6 |
| card-023 | Reverse Rotation | Turn order reverses for one round. | 1000017861 slot 7 |
| card-024 | Friend Boost | Choose one player. You both move forward 2 spaces. | 1000017861 slot 8 |
| card-025 | Good Vibes Only | Move forward 4 spaces. | 1000017862 slot 1 |
| card-026 | Rosin Spill | Move back 3 spaces. | 1000017862 slot 2 |
| card-027 | Free Pass | Keep this card. Ignore the next card that makes you move backward. | 1000017862 slot 7 |
| card-028 | High Roller | Roll again and move that many extra spaces. | 1000017862 slot 8 |
| card-029 | Rosin Rail Ride | Move forward 6 spaces. | 1000017863 slot 2 |
| card-030 | Munchie Mountain | Move forward 3 spaces, then stop. | 1000017863 slot 3 |
| card-031 | Kief Cave Slip | Move back 3 spaces and draw again. | 1000017863 slot 4 |
| card-032 | Rolling Breeze | Move forward 1 space. | 1000017866 slot 1 |
| card-033 | Dankwood Fog | Lose your next turn. | 1000017866 slot 2 |
| card-034 | Golden Track | Move forward 4 spaces. | 1000017866 slot 3 |
| card-035 | Sugar Crash | Move back 2 spaces. | 1000017866 slot 4 |
| card-036 | Crystal Tunnel | Move forward 3 spaces. | 1000017866 slot 5 |
| card-037 | Trichome Slide | Move back 5 spaces. | 1000017866 slot 6 |
| card-038 | Cloud Lift | Move forward 4 spaces. | 1000017866 slot 7 |
| card-039 | Second Hit | Draw another Hit Card. | 1000017866 slot 8 |

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

`apps/high-land-web/public/assets/images/cards/hit/`

Recommended filenames:

- `card-001-perfect-roll.png`
- `card-002-cough-lock.png`
- `card-003-rosin-rush.png`
- ...
- `card-039-second-hit.png`

Variant assets should live in a separate archive folder, for example:

`apps/high-land-web/public/assets/images/cards/hit/variants/`

## Implementation note

Do not fully swap the live browser game to this approved art deck until the game logic is audited against these exact card effects. Several approved cards require mechanics beyond the current minimal live deck, including:

- draw another card after moving
- choose one other player
- everyone skips a turn/move except the current player
- reverse turn order
- keep/protect card state

Art intake and asset labeling can happen now. Full gameplay logic alignment should happen next as a separate implementation pass.
