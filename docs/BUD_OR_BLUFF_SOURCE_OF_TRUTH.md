# Bud or Bluff — Source of Truth

Bud or Bluff is the DTF adult cannabis cultivar-name guessing game built around two outcomes: **BUD** for a documented real cultivar/strain name and **BLUFF** for a game-created name that has been screened against current references.

## Canonical ownership

- The Google Sheet `Bud or Bluff - Strain Database` remains canonical for editable research, verification work, QA review, and approved real/fake name decisions.
- `dtfgenetics/Thc` is the canonical GitHub integration and machine-data repository for Bud or Bluff under `games/bud-or-bluff/`.
- `games/bud-or-bluff/data/real-name-groups.json` is the application-ready grouped export for documented real names and source metadata.
- Google Drive `04 Games/Bud or Bluff` remains canonical for approved human-facing rules, art, print layouts, playtest records, and release packages.

## Verification boundaries

A BUD record establishes documented cannabis-name usage from the cited source. It does not prove identical genetics across every product using that name, validate every lineage claim, or provide trademark/name clearance.

A proposed BLUFF name must be searched again against current cultivar/strain references before publication so a documented real name is not mislabeled as fake.

## Production rule

Do not publish research rows blindly. Before a real-name card enters a final release, confirm spelling/aliases, source accessibility, reasonable secondary corroboration, uncertainty labeling where needed, and separate review for trademark, celebrity, fictional-character, media-title, and brand-name risk.

Future browser-game code should use the controlled data under `games/bud-or-bluff/` and deploy through the DTF Game Hub rather than creating an unrelated production source of truth.
