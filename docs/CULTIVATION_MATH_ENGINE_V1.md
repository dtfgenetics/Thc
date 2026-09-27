# THC Cultivation Math Engine v1

Shared deterministic calculation primitives for THC cultivation tools.

## Scope

- PPFD ↔ DLI and segmented/variable-light DLI integration.
- Saturation vapor pressure, air VPD, measured-leaf VPD and dew point.
- Stock-solution and serial-dilution math.
- Ventilation air-changes-per-hour calculation.
- Gallon/liter conversion.

The engine is intentionally pure: no DOM, storage, network, cultivar recommendations or UI state. Tool pages provide interpretation and education separately.

## Validation

Run:

```sh
node scripts/test-cultivation-math-engine.mjs
```

The contract covers known DLI, VPD, dilution, dew-point, ventilation and unit-conversion fixtures plus invalid-input behavior.

## Integration rule

Migrate one public tool at a time. Preserve the existing route and UI behavior, replace duplicate formula implementations with imports from `/assets/thc-cultivation-math-v1.mjs`, then run the tool-suite validator and relevant release checks before moving to another tool.

## Provenance

The implementation uses standard published engineering/horticultural equations and was written for DTF/THC rather than copied wholesale from an external project. External open-source projects are used as architecture and UX references; direct code reuse requires compatible licensing and attribution where applicable.
