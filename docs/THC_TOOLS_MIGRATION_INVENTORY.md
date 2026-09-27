# THC Tools Migration Inventory

Generated from `data/tool-registry.json`, `site/deployment/public-apps.json`, `data/public-navigation.json`, and direct GitHub source-path checks on branch `feat/thc-tools-repo-migration`.

## Inventory result

The repository split currently covers **23 route surfaces**: the Tools hub, Plant Atlas, Terpene Atlas, four original measurement/reference tools, and sixteen newer cultivation tools.

All 23 canonical route entry files were found in `site/public-route-patch`. All declared shared runtime assets were also found.

| Tool | Route | Deployment identity | Navigation identity | GrowLens bridge |
| --- | --- | --- | --- | --- |
| Cultivation Tools | `/tools/` | site route | root route | no |
| THC Living Plant Atlas | `/atlas/` | `plant-atlas` | `atlas` | no |
| THC Terpene Atlas | `/terpene-atlas/` | `terpene-atlas` | `terpene-atlas` | no |
| pH Meter | `/ph-meter/` | `ph-meter` | `ph-meter` | no |
| TDS / EC Meter | `/tds-meter/` | `tds-meter` | `tds-meter` | no |
| VPD Chart | `/vpd-chart/` | `vpd-chart` | `vpd-chart` | no |
| THC Light Lab | `/ppfd-chart/` | `ppfd-chart` | `ppfd-chart` | no |
| THC Water Quality Lab | `/water-quality-lab/` | `water-quality-lab` | `water-quality-lab` | yes |
| THC Fertigation Lab | `/fertigation-lab/` | `fertigation-lab` | `fertigation-lab` | yes |
| THC Irrigation & Dryback Lab | `/dryback-lab/` | `dryback-lab` | `dryback-lab` | yes |
| THC Dew Point & Condensation Lab | `/dew-point/` | `dew-point` | `dew-point` | no |
| THC Environmental Control Center | `/environment-control/` | `environment-control` | `environment-control` | yes |
| THC IPM Scout | `/ipm-scout/` | `ipm-scout` | `ipm-scout` | yes |
| THC Dry & Cure Lab | `/dry-cure-lab/` | `dry-cure-lab` | `dry-cure-lab` | yes |
| THC Grow Cycle Planner | `/grow-planner/` | `grow-planner` | `grow-planner` | yes |
| THC Substrate & Container Calculator | `/substrate-calculator/` | `substrate-calculator` | `substrate-calculator` | no |
| DTF Breeding & Pedigree Builder | `/breeder-pedigree/` | `breeder-pedigree` | `breeder-pedigree` | no |
| THC Ventilation & CO₂ Reference | `/co2-ventilation/` | `co2-ventilation` | `co2-ventilation` | no |
| THC Photoperiod & Lighting Schedule | `/photoperiod-planner/` | `photoperiod-planner` | `photoperiod-planner` | no |
| THC Plant Growth Tracker | `/plant-growth-tracker/` | `plant-growth-tracker` | `plant-growth-tracker` | yes |
| THC Root-Zone Temperature Reference | `/root-zone-temperature/` | `root-zone-temperature` | `root-zone-temperature` | yes |
| THC Solution Dilution Calculator | `/dilution-calculator/` | `dilution-calculator` | `dilution-calculator` | no |
| THC Cultivation Unit Converter | `/unit-converter/` | `unit-converter` | `unit-converter` | no |

## Shared runtime to migrate

The new repository must own these currently verified files rather than reaching back into `dtfgenetics/Thc`:

- `site/public-route-patch/assets/thc-tool-suite-v1.css`
- `site/public-route-patch/assets/thc-tool-suite-v1.js`
- `site/public-route-patch/assets/thc-cultivation-math-v1.mjs`
- `site/public-route-patch/assets/thc-light-lab-math-v1.mjs`
- `site/public-route-patch/assets/thc-measurement-journal-v1.js`
- `site/public-route-patch/assets/breeder-pedigree-graph-v1.js`
- `site/public-route-patch/assets/vendor/papaparse-5.7.0.min.js`
- `site/public-route-patch/assets/vendor/uplot-1.6.32.min.js`
- `site/public-route-patch/assets/vendor/uplot-1.6.32.min.css`
- `site/public-route-patch/assets/vendor/cytoscape-3.34.3.min.js`

Third-party notices/licenses must migrate with vendored dependencies.

## Special source ownership

Plant Atlas and Terpene Atlas have two relevant source locations today:

- deployment source: `apps/growlens-web/public/atlas` and `apps/growlens-web/public/terpene-atlas`
- public-suite mirror: `site/public-route-patch/atlas` and `site/public-route-patch/terpene-atlas`

The new repository migration must reconcile these pairs rather than blindly copying one and losing the other. The public route remains `/atlas/` or `/terpene-atlas/`.

## Existing metadata drift

The current deployment manifest marks the newer cultivation tools as `ready-to-package`, while `data/public-navigation.json` still labels many of the same routes as `development` with `public:false`.

This is a release-metadata inconsistency, not a reason to omit those tools from repository ownership. The new canonical registry owns the complete tool set and Task 2 will make validation derive from that registry. Release visibility should be reconciled deliberately instead of inherited from contradictory manifests.

## Existing validation drift

The old tool-suite validator covers the sixteen newer cultivation routes, while the old live verifier used a separately maintained list and omitted at least:

- `/ipm-scout/`
- `/grow-planner/`
- `/breeder-pedigree/`

Task 2 replaces those independent lists with registry-driven coverage.

## Dependency notes

- Papa Parse is used by CSV import/export workflows including pH, TDS/EC, VPD, and PPFD/Light Lab.
- uPlot supports measurement/trend visualization including pH, TDS/EC, VPD, and IPM Scout.
- Cytoscape.js and `breeder-pedigree-graph-v1.js` support the interactive pedigree graph.
- The cultivation math module is shared by conversion, environment, irrigation, lighting, nutrition, and ventilation tools.
- GrowLens bridge behavior is declared per route in the canonical registry and must survive the repository move.

## Cutover rule

No source listed here is deleted from `dtfgenetics/Thc` until `dtfgenetics/thc-tools` exists, contains the equivalent route/runtime payload, and passes local plus live parity verification.
