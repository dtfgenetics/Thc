# Cultivation reference tools

Production site: `https://dtfseeds.com`

## Purpose

The Cultivation Tools hub at `/tools/` is the launcher. Reference tools that need their own working surface remain standalone routes instead of being embedded into GrowLens or the Tools landing page.

## Canonical routes

| Tool | Route | Role |
| --- | --- | --- |
| Plant Atlas | `/atlas/` | Interactive plant anatomy and plant-science explorer |
| Terpene Atlas | `/terpene-atlas/` | Terpene chemistry, evidence and measured-sample explorer |
| pH Meter | `/ph-meter/` | Interpretation of calibrated pH readings and broad cultivation reference windows |
| TDS / EC Meter | `/tds-meter/` | EC and common 500/700 ppm scale conversion/reference |
| VPD Chart | `/vpd-chart/` | Leaf-VPD calculation and nearby temperature/RH reference table |
| PPFD / DLI Tool | `/ppfd-chart/` | PPFD↔DLI calculation, variable-light integration, target-DLI reverse calculation and configurable 3×3 through 9×9 canopy mapping |

## UX contract

1. `/tools/` must visibly expose all six reference tools in the hero/primary cultivation-tools section.
2. Reference launchers from `/tools/` open in a new browser tab so the grow-management or diagnostic context remains open.
3. The four meter/chart routes are standalone pages and must not be reduced to modal-only or hidden controls.
4. Every standalone reference page must provide a clear route back to `/tools/`.
5. Plant Atlas and Terpene Atlas remain Learn-owned scientific explorers but are also discoverable from Tools.
6. pH and TDS pages interpret measurements from external/calibrated instruments; the browser is not presented as a physical sensor.
7. PPFD/DLI calculations must show the exact time-conversion relationship and canopy-map context without presenting universal cannabis stage targets as biological law.
8. VPD calculations must expose air temperature, RH and leaf-temperature context rather than presenting one universal target as a diagnosis.
9. Canonical Header V6, responsive layout, accessibility/focus behavior and public route verification apply to every route.
10. pH, TDS/EC, VPD and PPFD/DLI share the THC cultivation-context shell so Grow/Room/Zone/Plant/Cultivar/Stage context remains available across the reference workflow.
11. PPFD canopy mapping must preserve configurable row/column grids rather than regressing to a fixed 3×3 implementation.

## Release ownership

Canonical implementation source is `dtfgenetics/Tools`.

The matching paths under `dtfgenetics/Thc/site/public-route-patch/` are deployment/integration mirrors used by the public-suite packager, resource-aware WordPress publisher, and Hostinger deployment path. Tool features, fixes, datasets, shared runtime changes, and cultivation-math changes must originate in `dtfgenetics/Tools`; the integration mirror must not overwrite the canonical repository.

## Validation

Run:

`npm run verify:cultivation-reference-tools`

The validation gate protects hub links, new-tab behavior, central return links, canonical navigation, pH/TDS conversion contracts, VPD calculation contract, and PPFD/DLI mapping contract.
