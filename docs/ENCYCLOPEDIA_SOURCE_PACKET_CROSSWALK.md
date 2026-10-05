# THC Encyclopedia Source-Packet Crosswalk

Updated: 2026-10-04

## Purpose

This document records how the uploaded **THC Cannabis Plant Science Source Packet v1** maps into the canonical 420-topic THC Plant Science Encyclopedia. It exists to prevent future agents from creating a second taxonomy merely because the source packet uses broader chapter headings.

The source packet is a science/source backbone. The canonical Encyclopedia remains the permanent identity and navigation system.

## Source-packet coverage

| Plant Science Source Packet area | Canonical Encyclopedia coverage |
|---|---|
| Taxonomy, Origin, and Botanical Identity | Part 01 — Plant Structure & Anatomy; supporting genetics/taxonomy context in Part 08 |
| Anatomy and Morphology Reference | Part 01 — Plant Structure & Anatomy |
| Life Cycle and Developmental Stages | Part 02 — Seeds, Germination & Seedlings; Part 11 — Flowering & Reproduction; Part 18 — Harvest & Postharvest |
| Core Plant Physiology for Cultivation SOPs | Part 04 — Plant Physiology; Part 05 — Water & Environment; Part 06 — Lighting & Photobiology |
| Cannabinoid, Terpene, and Trichome Science | Part 12 — Trichomes & Cannabinoids; Part 13 — Terpenes & Secondary Metabolites; postharvest effects in Part 18 |
| Genetics, Chemotype, Sex, and Propagation Science | Part 08 — Genetics, Sex & Chemotype; Part 09 — Cloning, Tissue Culture & Germplasm; Part 11 — Flowering & Reproduction; Part 20 — Breeding & Genetic Conservation |
| Environment and Root-Zone Data Model | Part 03 — Roots, Rhizosphere & Growing Media; Part 05 — Water & Environment; Part 06 — Lighting & Photobiology; Part 07 — Nutrition & Root-Zone Chemistry; Part 14 — Diagnostics & Abiotic Disorders; Part 19 — Outdoor & Greenhouse Growing; Part 21 — Measurement & Research Skills |
| Mineral Nutrition and Deficiency/Toxicity Logic | Part 07 — Nutrition & Root-Zone Chemistry; Part 14 — Diagnostics & Abiotic Disorders |
| Plant Health, Pathogens, Pests, and the Disease Triangle | Part 14 — Diagnostics & Abiotic Disorders; Part 15 — Pests; Part 16 — Diseases & Viroids; Part 17 — IPM, Biosecurity & Sanitation; relevant postharvest microbial risk in Part 18 |
| Master Data Dictionary for Future SOP Forms | Part 21 — Measurement & Research Skills plus the separate records/tools/SOP systems |

## Architectural conclusion

The source packet does not require a new top-level Encyclopedia domain. Its science scope is already represented by the controlled 21-part / 420-ID architecture.

Future work should therefore:

1. deepen individual THC-ENC lessons when the source packet contains stronger evidence or explanations;
2. add source/evidence mappings rather than duplicate lessons;
3. connect relevant SOPs, logs, tools, and diagnostics through cross-links;
4. use THC-ENC-421+ only when a genuinely distinct non-duplicate scientific topic passes the expansion gate;
5. keep occupational/facility SOP content separate from plant-science Encyclopedia identity.

## Source-packet drafting constraints preserved

The source packet emphasizes several rules that remain binding across Encyclopedia/SOP integration:

- distinguish plant-level conditions from room/controller setpoints;
- diagnose nutrient problems from pattern, context, and measurements rather than leaf appearance alone;
- treat cannabinoid/terpene profiles as genotype- and context-dependent rather than fixed promises;
- preserve the disease-triangle model for plant-health reasoning;
- use local law/product labels before operational pesticide recommendations;
- record what was measured before making corrective claims.

## Related canonical controls

- `content/encyclopedia/current-controlled-registry.json`
- `configuration/encyclopedia-topics.json`
- `docs/ENCYCLOPEDIA_CONTENT_GAP_REGISTER.md`
- `.agents/skills/thc-encyclopedia-production/SKILL.md`
- `content/encyclopedia/evidence/authoritative-sources.json`

This crosswalk is explanatory provenance. It does not renumber lessons, authorize publication, approve scientific claims, or replace claim-level evidence review.
