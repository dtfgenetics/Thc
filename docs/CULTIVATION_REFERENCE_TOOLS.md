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
| PPFD / DLI Tool | `/ppfd-chart/` | PPFD↔DLI calculation, target-DLI reverse calculation and 3×3 canopy-uniformity mapping |

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

## Release ownership

Canonical source lives in:

- `site/public-route-patch/tools/index.html`
- `site/public-route-patch/atlas/`
- `site/public-route-patch/terpene-atlas/`
- `site/public-route-patch/ph-meter/`
- `site/public-route-patch/tds-meter/`
- `site/public-route-patch/vpd-chart/`
- `site/public-route-patch/ppfd-chart/`

The routes are registered in `data/public-navigation.json` and `site/deployment/public-apps.json`. The public-suite packager, resource-aware WordPress publisher and Hostinger public-suite fallback must all preserve these routes.

## Validation

Run:

`npm run verify:cultivation-reference-tools`

The validation gate protects hub links, new-tab behavior, central return links, canonical navigation, pH/TDS conversion contracts, VPD calculation contract, and PPFD/DLI mapping contract.
