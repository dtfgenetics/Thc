# Pheno Hunter

Pheno Hunter is a deterministic keeper-selection scouting game for DTF Games. It focuses on observation discipline and selection tradeoffs rather than combat, collection, or cross-building.

## First playable loop

- A six-character hunt code selects one keeper brief and an eight-candidate fictional cohort.
- Vigor, Structure, and Finish Speed are visible baseline traits.
- Resin, Aroma, Yield Potential, and Stability begin hidden.
- The player has ten scouting tokens to reveal hidden observations across the cohort.
- Up to three candidates may be shortlisted.
- The final keeper must come from the shortlist.
- Final score combines objective fit, evidence gathered on the chosen keeper, and whether the player compared multiple candidates.
- The same code reproduces the same target brief, cohort, and ordering for replay or sharing.

## Distinction from other DTF games

- **PhenoQuest** is an exploration/collection RPG with battles, clone rooting, and lineage restoration.
- **Pheno Draft** is a roguelike breeding card draft with crosses and generated offspring.
- **Pheno Hunter** is a focused scouting/keeper-selection puzzle with a limited observation budget.

## Content boundary

All candidate names, families, scores, and target briefs are fictional game data. Trait scores illustrate selection tradeoffs only; they are not real cultivar claims, breeding probabilities, potency data, or guaranteed outcomes.

## Source of truth

- Data: `games/pheno-hunter/data/phenos.json`
- Engine: `games/pheno-hunter/src/engine.mjs`
- Tests: `games/pheno-hunter/test/engine.test.mjs`
- Validator: `games/pheno-hunter/scripts/validate-data.mjs`
- Public route: `site/public-route-patch/games/pheno-hunter/`
