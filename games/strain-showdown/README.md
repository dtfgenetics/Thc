# Strain Showdown

**Strain Showdown** is an original cannabis-themed trading-card battle system organized around eight strain families. This directory owns the machine-readable roster, family identities, rules data, Drive provenance records, and validation.

## Locked families

Kush, Haze, Skunk, Gas, Cookies, Fruit, Purple, Frost.

## Locked card progression

Each family contains 12 strain cards: 6 Tier 1 Base, 4 Tier 2 Select, and 2 Tier 3 Elite, for a 96-strain core roster.

## Battle model

- **Vigor** is the primary defensive stat.
- **Power** is the primary attacking stat.
- Strains progress through three stages/tiers.
- Tier 2 advances from a same-family Tier 1 card.
- Tier 3 advances from a same-family Tier 2 card.
- Family identities create distinct strategic stat profiles without making one family strictly superior by design.

## Current machine state

- Full 96-card roster is present under `data/roster/`.
- `data/roster-manifest.json` controls roster count, files, tier distribution, and stage progression.
- `data/families.json` controls family identity.
- Drive starter-tracker provenance is preserved in `data/drive-production-tracker-source.json` and must not overwrite the completed roster.
- The roster validator checks the machine-controlled roster, including DTF Genetics cross-links where applicable.

## Current status

`roster-data-alpha` — names, IDs, family, tier/stage, Vigor/Power, role tags, and progression links are machine controlled. Full card effect text, final battle/tournament rules, balance tuning, art, and browser gameplay remain later release gates.
