# Cornell / USDA bioinformatics ingestion

This lane makes Cornell, USDA-ARS, GRIN/GRIN-Global and Breeding Insight genetics resources reusable across DTF systems without treating every public webpage as an ingestible dataset.

## Machine-readable authority

- Registry: `data/research/cornell-bioinformatics-registry.json`
- Schema: `data/research/cornell-bioinformatics-registry.schema.json`

The registry intentionally records both **scientific value** and **reuse status**. A source can be authoritative research and still be reference-only until its exact downloadable payload and license are verified.

## Downstream consumers

The first consumers are:

- Encyclopedia genetics and plant-science content
- Breeder Journal / lineage system
- Plant Atlas
- Grow-data collection design
- Grow Doc disease-resistance and evidence retrieval
- Future genotype/marker tools

No consumer should infer that a hemp population directly describes a DTF cultivar. Public hemp evidence is a reference layer; DTF phenotype, genotype, chemotype and selection observations remain separate DTF records.

## Data model

Normalize future payloads into six interoperable record families:

1. germplasm
2. genotype
3. phenotype
4. experiment
5. chemotype
6. lineage

Each record preserves source identity and the experiment/population context needed to keep evidence scientifically scoped.

## Current P0 work

1. Resolve the actual downloadable **Hemp_DArTag_BI_Cornell_University v1.0** marker payload, including marker IDs, coordinates/reference build, file format and redistribution terms.
2. Resolve USDA/GRIN Cannabis sativa accessions and observation data associated with the Geneva hemp germplasm and disease-resistance work.
3. Identify Cornell publications or repositories exposing machine-readable phenotype, chemotype, flowering, sex-expression or high-throughput phenotyping data.
4. Add adapters only after payload identity and reuse rights are verified.

## Guardrails

- Citation does not equal permission to copy.
- Public research metadata does not equal training eligibility.
- Do not merge hemp observations into DTF cultivar truth.
- Do not discard accession, population, environment, assay, reference-genome or protocol context.
- Derived records must retain a stable source identifier and original URL.
