# Cultivation Math Engine v1 — Integration Plan

Migrate incrementally; do not rewrite all tool pages at once.

1. **PPFD Light Lab** — replace duplicated DLI math; add reverse DLI→PPFD and segmented/ramped-light calculation UI.
2. **Environmental Control / VPD** — use shared saturation pressure, air VPD and measured-leaf VPD; clearly label measurement assumptions.
3. **Dew Point Lab** — replace duplicate dew-point formula.
4. **Dilution Calculator** — replace C1V1/C2V2 duplicate math and expose deterministic serial-dilution steps.
5. **CO2/Ventilation** — replace ACH duplicate math.
6. **Unit Converter** — centralize gallon/liter primitives, then expand only with tested conversions.

For each migration:
- preserve route, branding and existing working storage/bridges;
- add/extend a failing deterministic contract first;
- make the smallest implementation change;
- run the shared engine checks plus `scripts/validate-thc-tool-suite-v1.mjs`;
- run relevant package/route/build checks before merge;
- do not use Playwright.
