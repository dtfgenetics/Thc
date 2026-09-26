# DTF Terpene Atlas scope and data contract

Status: active build

The Terpene Atlas is a searchable scientific knowledge system, not a decorative flavor wheel.

## Canonical scope

The project maintains two related but distinct catalogs:

1. **Global terpene/terpenoid universe** — compounds known from nature and chemistry references.
2. **Cannabis-reported set** — compounds with traceable evidence of occurrence in Cannabis material.

A compound can belong to both. Global occurrence must never be presented as proof of Cannabis occurrence.

## Measurement rule

Cultivar names do not have one fixed terpene percentage. Percentages and concentrations belong to measured samples, analytical methods and sources. The Atlas stores cultivar labels separately from sample measurements and preserves units, ranges, detection limits and uncertainty.

## Evidence levels

- **A** — primary analytical study or laboratory record with method/sample information.
- **B** — peer-reviewed review with traceable primary references.
- **C** — secondary reference used only for orientation and never as sole support for a quantitative cultivar claim.

## Required product layers

- ontology and aliases;
- chemistry and identifiers;
- family/class/subclass;
- sensory descriptors with provenance;
- Cannabis occurrence evidence;
- laboratory/sample profiles;
- cultivar explorer built from samples, not marketing claims;
- evidence-graded mechanism/effect summaries;
- cultivation and post-harvest factors affecting volatile profiles;
- interactive wheel/atlas visualization;
- comparison mode;
- source panel and uncertainty language;
- accessible keyboard/touch/table alternatives;
- links into Plant Atlas trichome and flower modules.

The current catalog is deliberately marked `seed-catalog-in-expansion`. It must not be represented as complete until the cannabis literature inventory and the global ontology import have both passed validation.

## Current production state (2026-09-26)

- **120-record production floor:** the validator rejects a curated ontology below 120 compounds.
- **Reference-inventory caution:** Radwan et al. (2021) reports 120 Cannabis terpenes. The Atlas currently also contains 120 curated records, but this numerical match is **not** treated as proof that every identity, synonym, stereoisomer, and miscellaneous terpene maps one-to-one to that review inventory.
- **Measured data:** 40 mapped analytes summarize variability across 79 Cannabis inflorescences in ppm; these values are population statistics, not cultivar promises.
- **Sample-first rule:** individual cultivar or breeding-line percentages require a traceable measured sample. Strain names are metadata, not measurements.
- **Interpretation layer:** profile drivers cover genetics, tissue, development, environment, harvest handling, drying/storage, analytical method, and naming provenance.
- **Evidence layer:** mechanism and safety records state experimental model, human-evidence status, limitations, and source provenance; preclinical findings are not rendered as proven human treatment effects.
- **Data-quality visibility:** formula, aroma, stereochemistry, and PubChem identifier coverage are surfaced to users instead of silently inferred.
- **Shareable records:** compound detail views support direct query links such as `/terpene-atlas/?compound=beta-caryophyllene`.
