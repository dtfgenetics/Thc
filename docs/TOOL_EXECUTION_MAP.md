# Tool Execution and Repository Map

This is the human-readable companion to `data/tool-execution-registry.json`. The JSON registry is authoritative for automation.

## Execution rule

Before changing any cultivation tool:

1. Resolve the tool in `data/tool-execution-registry.json`.
2. Edit only the listed canonical repository/path.
3. Run the listed verification command in that canonical repository.
4. Produce or synchronize the deployment artifact into `dtfgenetics/Thc`.
5. Run production integration checks from `dtfgenetics/Thc`.
6. Verify the visitor-facing route after deployment.

Do not repair a mirrored copy and then treat the mirror as source. Move the fix upstream to the canonical owner.

## Primary workflows

| Tool | Public route | Canonical authoring location | Canonical verification | Production integration |
| --- | --- | --- | --- | --- |
| THC GrowLens | `/growlens/` | `dtfgenetics/Thc:apps/growlens-web` | `npm run verify:growlens` | Same repo; production package under the site deployment layer |
| THC Grow Doc | `/thc-grow-doc/` | `dtfgenetics/Thc-dataset` | `npm run check && npm test` | Version-pinned artifact deployed by `dtfgenetics/Thc` |

## Focused cultivation/reference suite

Every tool below is authored in `dtfgenetics/Tools`, under `site/public-route-patch/<tool>`, and validated by the Tools repository test suite with `npm test`. The corresponding path in `dtfgenetics/Thc/site/public-route-patch/` is a generated/synchronized deployment mirror.

| Tool | Public route | Canonical path |
| --- | --- | --- |
| Tools Hub | `/tools/` | `site/public-route-patch/tools` |
| Plant Atlas | `/atlas/` | `site/public-route-patch/atlas` |
| Terpene Atlas | `/terpene-atlas/` | `site/public-route-patch/terpene-atlas` |
| pH Meter | `/ph-meter/` | `site/public-route-patch/ph-meter` |
| TDS / EC Meter | `/tds-meter/` | `site/public-route-patch/tds-meter` |
| VPD Chart | `/vpd-chart/` | `site/public-route-patch/vpd-chart` |
| PPFD / DLI Light Lab | `/ppfd-chart/` | `site/public-route-patch/ppfd-chart` |
| Environment Control Center | `/environment-control/` | `site/public-route-patch/environment-control` |
| Dew Point Lab | `/dew-point/` | `site/public-route-patch/dew-point` |
| Water Quality Lab | `/water-quality-lab/` | `site/public-route-patch/water-quality-lab` |
| Root-Zone Temperature | `/root-zone-temperature/` | `site/public-route-patch/root-zone-temperature` |
| Dryback Lab | `/dryback-lab/` | `site/public-route-patch/dryback-lab` |
| Fertigation Lab | `/fertigation-lab/` | `site/public-route-patch/fertigation-lab` |
| Grow Planner | `/grow-planner/` | `site/public-route-patch/grow-planner` |
| Photoperiod Planner | `/photoperiod-planner/` | `site/public-route-patch/photoperiod-planner` |
| Plant Growth Tracker | `/plant-growth-tracker/` | `site/public-route-patch/plant-growth-tracker` |
| Dry & Cure Lab | `/dry-cure-lab/` | `site/public-route-patch/dry-cure-lab` |
| Breeder Pedigree Builder | `/breeder-pedigree/` | `site/public-route-patch/breeder-pedigree` |
| Ventilation / CO2 | `/co2-ventilation/` | `site/public-route-patch/co2-ventilation` |
| Dilution Calculator | `/dilution-calculator/` | `site/public-route-patch/dilution-calculator` |
| IPM Scout | `/ipm-scout/` | `site/public-route-patch/ipm-scout` |
| Substrate Calculator | `/substrate-calculator/` | `site/public-route-patch/substrate-calculator` |
| Unit Converter | `/unit-converter/` | `site/public-route-patch/unit-converter` |

## Repositories that must not become alternate tool sources

- `dtfgenetics/Dtf420` is a controlled future-cutover workspace.
- `dtfgenetics/dtf-thc-hub` is a migration/legacy combined workspace.
- Mirrored paths under `dtfgenetics/Thc/site/public-route-patch/` are deployment artifacts unless the registry explicitly says otherwise.

A change in those locations is not a canonical tool change unless the ownership registry is changed deliberately in the same reviewed change.
