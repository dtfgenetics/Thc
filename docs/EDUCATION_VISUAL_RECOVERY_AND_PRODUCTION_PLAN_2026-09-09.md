# DTFSeeds / THC Education Visual Recovery and Production Plan

Updated: 2026-09-09

## Goal

Restore the THC education site to a complete, polished visual system without reintroducing rejected simple artwork, broken image references, stale placeholders, or misleading near-match graphics.

The first action for every missing visual is **recovery**, not generation. Google Drive contains a large historical and current THC visual library, including approved, final-for-review, draft, legacy, quarantined, and superseded files. Existing artwork must be reconciled before any new image is created.

## Locked production rule

Work on **one image at a time**.

For each image:

1. Identify the exact lesson/page gap.
2. Search Google Drive, transfer decks, recovery catalogs, and current canonical repo assets for an exact concept match.
3. Classify the candidate as approved, review-required, draft/legacy/quarantine, or missing.
4. Validate the actual binary, dimensions, text, scientific claims, and approved THC visual style.
5. If an approved exact match exists, recover/import that one asset.
6. If only a review candidate exists, review/correct that one asset before import.
7. If no correct asset exists, write one production brief and create one new image.
8. Add the approved master to the canonical infographic asset directory.
9. Update only the required visual map/page reference.
10. Run deterministic image-policy, file-existence, route/build, and publication checks.
11. Publish the one visual.
12. Verify the live desktop/mobile page and image URL.
13. Only then move to the next image.

No bulk generation. No automatic substitution. No filling gaps with a merely related image. No publication of DRAFT, REVIEW_REQUIRED, QA_REQUIRED, LEGACY, SUPERSEDED, QUARANTINE, corrupt, or reference-only artwork.

## Sources of truth

- Canonical repo visual maps under `site/wordpress/education/*-visual-map.json`
- Canonical infographic assets under `site/wordpress/assets/infographics/`
- Central exclusions: `site/wordpress/assets/infographics/infographic-exclusions.json`
- Approved-style policy under `docs/visual-policy/`
- Google Drive: `THC Infographic Search Catalog and Book Assembly Index v1.0`
- Google Drive: `THC Infographic - Master Merge Register v0.3 - Expanded Recovery`
- Google Drive: `THC Infographic Recovery Inventory — 2026-07-14`
- Google Drive: `THC Infographic Book Production Tracker v9`
- Google Drive transfer decks, including `THC Outdoor Infographic Production Transfer 2026-08-27`, `THC Transfer — Genetics and Breeding Infographics`, `THC Transfer — Remaining Core Infographics`, and numbered GitHub transfer decks.

The older Drive catalog/dashboard is historical and must not be treated as current approval state without reconciliation. It was last verified on 2026-08-04, while newer named Approved assets were created on 2026-08-24.

## Status model

- `RECOVER_APPROVED`: exact-match Drive asset explicitly approved; validate binary and import.
- `REVIEW_EXISTING`: useful existing asset but review/fix is required before import.
- `CREATE_NEW`: no exact usable asset found after Drive/transfer/catalog search.
- `REFERENCE_ONLY`: retain as evidence/source support but never publish as an infographic/page visual.
- `REJECTED`: legacy/simple/superseded/quarantined/corrupt/unsafe; never publish.
- `PUBLISHED_VERIFIED`: canonical asset imported, page mapped, live route verified.

## High-confidence Drive recovery candidates already identified

These are first-pass recovery candidates. Each still receives one-asset validation before insertion.

| Drive file | Drive ID | Initial state | Likely site use |
| --- | --- | --- | --- |
| THC_Growing_Factors_Cultivation_Foundations_Approved.png | `17BWVLFNuJNz2BKKgoZl8Cjm91sZQuckQ` | RECOVER_APPROVED | cultivation foundations / beginner learning |
| THC_Airflow_CO2_Leaf_Climate_Approved.png | `1co5Jd2bafzlu3T-KR2IDdC_LNTwHgfLU` | RECOVER_APPROVED | environment, airflow, canopy climate, CO2 |
| THC_Root_Zone_Humic_Fulvic_Acids_Nutrition_Approved.png | `1-jWuplFnBfgkA2e0G9tJlW3oEbBEA0No` | RECOVER_APPROVED | nutrition/root-zone support inputs |
| THC_Trichomes_Secretory_Biology_Approved.png | `1w3iaJ4oHxrRnlqHbIOSBsI7e2OWCNbAj` | RECOVER_APPROVED | plant biology trichome gap; post-harvest anatomy context |
| THC_Root_Zone_Mycorrhizae_Nutrition_Approved.png | `1DmaiJUzkyX4FYrc1NAdiozH5zudQEXVj` | RECOVER_APPROVED | nutrition/root-zone biology |
| THC_Plant_Training_Canopy_Approved.png | `1ohuggG-K8Mn0cHslOWON07aEAVcFywxu` | RECOVER_APPROVED | training/canopy overview |
| THC_Nutrient_Deficiencies_Diagnosis_Approved.png | `1YiG5q_uwCl0T2yo7OQqDGoLeMTOPk6Ti` | RECOVER_APPROVED | nutrition diagnosis / IPM differential context |
| THC_Seed_Anatomy_Germination_Approved.png | `1DaxzFIVh9cgBCAkoW8-qhlUCOKdZEzbM` | RECOVER_APPROVED | lifecycle/propagation seed and germination lessons |
| THC_Bud_Wash_Harvest_Postharvest_Approved.png | `1Bqni1JUarHhgTynVo2bQXsNGC8iK-Jsx` | REVIEW_EXISTING | harvest/post-harvest; verify revised claims against current exclusion reason before replacing withheld older HARV-04 |
| THC-HARV-03_harvest_handling_workflow.jpg | `1m-tZDTbeHwb4cJvjm7lzmg6F6XaS8RDQ` | REVIEW_EXISTING | harvest handling workflow |
| THC_Air_During_Drying_and_Curing_Improved_v2.png | `1wA87NrClZDhz7wDv9z2QzB6wMYS1NtGk` | REVIEW_EXISTING | drying/curing environment |
| THC-C005_Infographic_Root_Anatomy_and_Forensics_300dpi.png | `1gyRWv1Ud57ZpcNFFRtqoopz0xjFul_9_` | protected duplicate/recovery source | canonical C005 backup/source |
| THC-C007_Infographic_Leaf_Anatomy_Gas_Exchange_300dpi.png | `1pieHgJVN11mF4jMxd5kMjA2eKm5AFnJj` | protected duplicate/recovery source | canonical C007 backup/source |

## Explicit non-publish Drive states

The following filename/status markers are automatically excluded from direct site insertion:

- `DRAFT`
- `FINAL_FOR_REVIEW`
- `REVIEW_REQUIRED`
- `WEB_REVIEW_REQUIRED`
- `QA_REQUIRED`
- `LEGACY`
- `LEGACY-CANDIDATE`
- `SUPERSEDED`
- `QUARANTINE`
- `REBUILD_REQUIRED`
- corrupt/invalid-binary records

They may still be useful as research or redesign references, but never as the live image without a new approval state.

## Route-by-route recovery priority

### Priority 1 — Harvest / Post-Harvest

Reason: multiple exact topics already exist in Drive and several approved reference visuals have now been established.

Recover/search in this order:

1. Harvest handling workflow.
2. Drying environment / air during drying and curing.
3. Water activity vs moisture content.
4. Storage environment: light, heat, oxygen, moisture.
5. Post-harvest degradation pathways.
6. Trichome secretory biology / standardized maturity imaging as separate concepts.
7. Curing and moisture equalization.
8. Harvest readiness multiple-signals graphic.
9. Batch sampling and traceability.
10. Bud washing only after current scientific QA confirms the approved Drive replacement resolves the older exclusion issue.

### Priority 2 — Environment / VPD / Air

1. Recover approved Airflow + CO2 + Leaf Climate visual.
2. Recover and validate the existing VPD chart/master before making a replacement.
3. Air in canopy / grow-space air movement and exchange.
4. Air and the plant / stomata, boundary layer and transpiration.
5. Sensor placement, calibration and canopy mapping.
6. Leaf-temperature measurement geometry.
7. CO2 distribution and worker-safety separation.
8. Control bands, alarms, lights-on/off transitions and records.

### Priority 3 — Lighting

1. Recover the reviewed DLI/PPFD poster source from Drive before generating anything.
2. Search/recover Light Spectrum Effects on Cannabis Growth.
3. PAR vs ePAR vs lux vs PPFD measurement bands.
4. Fixture PPF to installed canopy PPFD.
5. PPFD grid / heat map / uniformity metrics.
6. Spectral photon distribution and red/far-red signaling if the recovered spectrum visual does not fully cover the lesson.

### Priority 4 — Plant Biology / Anatomy

1. Recover approved Trichomes & Secretory Biology.
2. Search Drive for the approved Cannabis sativa L. whole-species overview / whole-plant anatomy family.
3. Replace the removed flower anatomy/reproduction poster with an approved-style flower anatomy visual.
4. Pollination → fertilization → seed development sequence.
5. Senescence → nutrient remobilization → abscission sequence.

Reference-only `THC-ENC-001_VIS-*` artwork stays out of infographic surfaces even if it remains useful in source/evidence storage.

### Priority 5 — Lifecycle / Propagation

1. Recover approved Seed Anatomy & Germination.
2. Seed viability vs vigor.
3. Imbibition → radicle → emergence → establishment sequence.
4. Sex expression / chromosome combination visual if an approved exact-match Drive version exists.
5. Lifecycle traceability record.
6. Senescence/remobilization visual shared with Plant Biology where exact concept alignment permits.

### Priority 6 — Training / Canopy

1. Recover approved Plant Training & Canopy overview.
2. Low-stress bend radius and tie safety.
3. Topping cut → wound response → branch release.
4. Trellis/SCROG load paths and support geometry.
5. PPFD before/after training comparison.
6. Canopy airflow/interior microclimate map; reuse approved airflow visual only if it teaches the same concept exactly.
7. Service/scouting access layout.
8. Standardized canopy photography and measurements.

### Priority 7 — Nutrition / Root Zone

1. Recover approved Humic/Fulvic Acids visual.
2. Recover approved Mycorrhizae visual.
3. Recover approved Nutrient Deficiencies Diagnosis visual.
4. Search/review existing root-system, root-respiration, water-uptake, nutrient-uptake and rhizosphere files before creating replacements.
5. Nitrate vs ammonium and pH drift.
6. Phosphorus availability/adsorption/precipitation.
7. Potassium/cation competition.
8. Calcium supply vs transport demand.
9. Magnesium mobility & sulfur assimilation.
10. Micronutrient availability, pH and chelation.
11. Nutrient interaction mechanisms without a generic “lockout” label.
12. Product label → elemental formulation → stock compatibility.
13. Root-zone/tissue sampling methods.
14. Nutrition differential diagnosis and CAPA loop.

### Priority 8 — IPM / Plant Health

1. Reconcile approved Nutrient Deficiencies Diagnosis visual for exact-use eligibility.
2. Preserve approved Beneficial Insects & Biological Controls.
3. Scouting route, sticky cards and trend thresholds.
4. Small-pest identification comparison.
5. Powdery mildew vs Botrytis evidence/disease cycle.
6. HLVd transmission, sampling, testing and traceback.
7. Resistance management, biological compatibility and post-treatment verification.

### Priority 9 — Outdoor

Before creating any outdoor image, reconcile the Drive deck `THC Outdoor Infographic Production Transfer 2026-08-27` against the eleven currently open outdoor visual gaps:

1. site selection
2. seasonal sun path
3. hardening off
4. transplant/root establishment
5. wind load/support
6. rain + dense flower moisture risk
7. irrigation coverage/timing
8. wildlife exclusion
9. plant microclimates
10. pollen drift/unwanted pollination
11. seasonal planning timeline

### Priority 10 — Genetics / Breeding

Before creating any genetics image, reconcile `THC Transfer — Genetics and Breeding Infographics` and existing Drive breeding files against the current genetics visual map. Existing Drive candidates include breeding-generation, selfing/outcrossing and practical-barrier visuals but are not automatically approved.

Open concepts include genotype/environment/phenotype, gene expression, simple vs quantitative traits, population structure/admixture, pedigree vs identity, Mendelian basics, F1/F2 segregation, backcrossing, THCAS/CBDAS chemotype inheritance, sex determination/expression, regular/feminized/autoflower genetics, selection/progeny testing, quantitative phenotyping, stable-ID pedigree, trait-specific uniformity, line-development release gates, pollination/fertilization/seed production, polyploidy, marker-assisted vs genomic selection, pangenomes/structural variation, and breeding evidence-chain records.

### Priority 11 — Evidence / Measurement

1. accuracy vs precision vs resolution vs uncertainty
2. calibration, drift and reference cross-check
3. representative sensor placement/spatial grid
4. baseline/control/treatment/randomization
5. standardized imaging and scoring anchors
6. replication, uncertainty, correlation and evidence chain

### Priority 12 — First Grow Guide / beginner placement pages

The older Drive tracker contains many `REBUILD_REQUIRED` First Grow Guide page records. Do not create a duplicate image merely because a guide page is missing. First determine whether an approved canonical topic visual can serve that page accurately. Create a guide-specific master only when the page requires materially different teaching content or layout.

## Deduplication rule

One approved master may serve more than one route only when the teaching concept and labels are genuinely the same. Cross-route reuse must be explicit in the visual maps. Similarity is not sufficient.

Examples:

- A trichome anatomy image may support Plant Biology and anatomy context in Post-Harvest, but it must not substitute for a standardized trichome-maturity imaging guide.
- An airflow/CO2 overview may support Environment and a canopy lesson, but it must not replace a detailed sensor-placement or dead-zone map unless those concepts are actually shown.
- A nutrient-deficiency diagnostic visual may support Nutrition and IPM differential reasoning, but it must not be used as a pest-identification plate.

## Acceptance gate for every recovered or newly created visual

A visual cannot move to `PUBLISHED_VERIFIED` until all of the following pass:

- exact topic match
- approved THC visual style
- correct spelling and readable text
- scientifically defensible labels/claims
- no unsupported universal target presented as fact
- no broken/corrupt binary
- canonical filename and supported raster format
- high-resolution master preserved
- responsive web derivative available
- alt text and caption present
- visual map references exact canonical filename
- no central-exclusion match
- deterministic repo audit passes
- site build/publisher validation passes
- live desktop/mobile rendering verified

## Immediate next image sequence

Start with recovery, one image at a time:

1. `THC_Trichomes_Secretory_Biology_Approved.png` → validate → import/map → publish/verify.
2. `THC_Airflow_CO2_Leaf_Climate_Approved.png` → validate → import/map → publish/verify.
3. `THC_Seed_Anatomy_Germination_Approved.png` → validate → import/map → publish/verify.
4. `THC_Plant_Training_Canopy_Approved.png` → validate → import/map → publish/verify.
5. `THC_Nutrient_Deficiencies_Diagnosis_Approved.png` → validate → import/map → publish/verify.
6. `THC_Root_Zone_Humic_Fulvic_Acids_Nutrition_Approved.png` → validate → import/map → publish/verify.
7. `THC_Root_Zone_Mycorrhizae_Nutrition_Approved.png` → validate → import/map → publish/verify.
8. Harvest/post-harvest exact-match recovery pass: handling, drying, water activity, storage, degradation.
9. VPD/lighting exact-match recovery pass.
10. Outdoor transfer-deck reconciliation.
11. Genetics transfer-deck reconciliation.
12. Only then begin one-at-a-time new artwork production for concepts proven absent from Drive.

This sequence can change if an already-approved Drive asset exactly closes a higher-impact broken live page, but the one-image-at-a-time validation/publish rule does not change.
