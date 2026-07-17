# Bud or Bluff

**Bud or Bluff** is an adult cannabis-themed guessing game built around one question:

- **BUD** — the displayed cannabis cultivar/strain name is documented as real.
- **BLUFF** — the displayed name was created for the game and was checked against known strain databases.

## Current data status

As of **2026-07-17**, the research database contains:

- **200 unique BUD names**
- **100 reviewed names from the original pool**
- **100 newly added names**
- **0 rows missing a primary source URL**
- **1 documented spelling correction:** `Yuk Mouth` → `Yuck Mouth`

The editable source of truth is the Google Sheet **Bud or Bluff - Strain Database**, including the `Verified Real Names` and `QA Summary` tabs.

## Repository data

- `data/real-name-groups.json` — application-ready source groups containing all 200 verified names, source URLs, batch labels, source types, and the correction log.

The grouped format avoids repeating the same source URL for dozens of names documented on one genealogy page. A build script can flatten each group into individual card records.

## Verification meaning

`VERIFIED - EXACT NAME FOUND` means the exact name or a specifically documented styling of that name was located in at least one of the following:

1. An established cannabis strain profile.
2. A breeder or cultivar genealogy record.
3. A licensed-market cannabis product listing.
4. A strain-database editorial index that explicitly identifies the name as a cannabis strain or cultivar.

This verifies **documented cannabis name usage**. It does not establish that every product sold under the name has identical genetics, prove all lineage claims, or provide commercial name clearance.

## Production rule

A real-name card should not move from research to final commercial print production until:

1. Exact spelling and aliases are checked.
2. The primary citation remains accessible.
3. A second independent reference is added when reasonably available.
4. Disputed lineage claims are omitted or labeled uncertain.
5. Trademark, celebrity, fictional-character, media-title, and brand-name risks receive separate legal review.

Every proposed **BLUFF** name must also be searched against current strain databases before approval so the game does not accidentally label a real name as fake.
