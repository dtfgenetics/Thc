# Bud or Bluff

**Bud or Bluff** is an adult cannabis-themed guessing game built around one question:

- **BUD** — the displayed cannabis cultivar/strain name is documented as real.
- **BLUFF** — the displayed name was created for the game and was checked against known strain databases.

## Data files

- `data/verified-real-names.csv` — spreadsheet-friendly research pool.
- `data/verified-real-names.json` — application-ready version of the same records.

## Verification states

- `DOUBLE VERIFIED` — the exact name was found in at least two usable references.
- `PRIMARY VERIFIED - SECONDARY PENDING` — the exact name has a dedicated profile in an established strain database, but the second-source check is still pending.
- `RESEARCH POOL` — suitable for content development, but not yet locked for final print production.

## Production rule

A real-name card should not move from the research pool to the final deck until:

1. The exact spelling and aliases are checked.
2. At least one established strain database has a dedicated profile for the name.
3. A second independent reference is added when reasonably available.
4. Lineage claims are omitted or marked uncertain when sources disagree.
5. Trademark, celebrity, fictional-character, and brand-name risks are reviewed before commercial printing.

Cannabis cultivar names are not a standardized scientific naming system. A documented name proves that the name is used in the cannabis market or breeding community; it does not prove that every product sold under that name has identical genetics.
