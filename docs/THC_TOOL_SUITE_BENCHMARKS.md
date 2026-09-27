# THC Tool Suite Benchmark & Product Structure

Updated: 2026-09-26
Status: implementation guidance for the DTF/THC cultivation tool suite.

## Goal

The THC tool suite should behave as one cultivation decision-support system, not a collection of unrelated calculators. Every tool should follow the same progression:

1. **Context** — grow / room / zone / plant / stage / date / measurement method.
2. **Measure or plan** — the smallest set of inputs required for a useful answer.
3. **Result** — calculated values with units and uncertainty/assumption notes.
4. **Interpret** — explain what the result means and what it does *not* prove.
5. **Compare** — target, prior reading, room/zone peer, day/night, or previous run.
6. **Act** — smallest justified next check/action; avoid unsupported prescriptions.
7. **Record** — save locally and, when GrowLens integration is enabled, attach to the plant/space/timeline.
8. **Verify** — re-measure after the intervention and preserve the response.

## Benchmarks reviewed

### AROYA
Useful patterns:
- room/zone/harvest-group context before interpreting data;
- substrate WC/VWC, pore-water EC, dryback, runoff, climate and crop registration in one historical timeline;
- recipes/targets by crop phase rather than universal numbers;
- alert guardrails and comparison against prior successful runs;
- manual readings stored beside sensor streams.

Adopt:
- dryback phases and shot-size language;
- target envelopes, not one “ideal” value;
- stage-aware records;
- compare current run to previous run.

Do not copy:
- proprietary scoring, automation logic, branding, or commercial crop-steering prescriptions.

### Growlink
Useful patterns:
- climate, irrigation, substrate, lighting and nutrient delivery presented as connected control domains;
- explicit room/zone architecture;
- hardware/sensor identity attached to measurements;
- real-time monitoring and automation separated from configuration.

Adopt:
- common zone model across Environment, Dryback, PPFD and Root-Zone tools;
- sensor/meter identity fields;
- tool-to-tool context handoff.

### Pulse Grow
Useful patterns:
- one environmental dashboard for temperature, RH, VPD, light, CO2 and dew point;
- live vs historical views;
- day/night averages;
- user-defined alerts;
- offline/resync state is visible.

Adopt:
- day/night summaries;
- user-set thresholds;
- historical trend cards;
- “last reading / min / avg / max” pattern.

### UMass / Penn State greenhouse calculators
Useful patterns:
- formulas are visible;
- injector dilution ratio is an explicit input;
- fertilizer analysis is kept separate from desired elemental ppm;
- source-water chemistry is part of nutrient interpretation;
- method/units are preserved.

Adopt:
- stock-tank/injector mode in Fertigation Lab;
- source water pre-load;
- elemental vs oxide-form conversions;
- method notes and validation.

### HydroBuddy
Useful patterns:
- nutrient solution is solved as a multi-element target problem, not a single NPK slider;
- users can choose source compounds;
- target vs achieved concentrations are compared.

Adopt in later Fertigation v2:
- recipe solver;
- selectable fertilizer salts/products;
- target-vs-result matrix;
- incompatibility groups for concentrates.

### OpenFarmPlanner / Jninty
Useful patterns:
- crop stage calendar tied to tasks;
- quick logging;
- local-first/offline records;
- crop/space hierarchy;
- timeline and Gantt-like planning views.

Adopt:
- Grow Planner timeline;
- stage-triggered checklist;
- one-tap “log measurement” actions;
- local-first persistence shared with GrowLens.

### Open Pedigree / Pedimap / AGB
Useful patterns:
- lineage is visual;
- records remain connected across generations;
- phenotype/trait metadata belongs to nodes and selections;
- pedigree import/export is part of the data contract.

Adopt:
- graph/tree view;
- plant/selection IDs separate from cultivar/line names;
- cross event records;
- generation and seed-lot nodes;
- phenotype/selection attachments.

## Product rules

- No tool should publish one universal cannabis target as settled science when the correct value depends on genotype, stage, substrate, measurement method or environment.
- User-defined targets and documented source targets should be visually separated.
- Every reading must retain its units.
- Every record type should support a timestamp and measurement method.
- Mobile use is field use: primary inputs and Save/Compare actions must remain thumb-friendly.
- Historical context should be visible without forcing account creation.
- GrowLens is the canonical long-term record destination.
- Grow Doc is the escalation path for health problems.
- Plant Atlas and Learn are the explanation paths.
- Tools remain useful independently when GrowLens is unavailable.

## Priority implementation sequence

1. Shared context contract (grow/space/zone/plant/stage/time/method).
2. Environment Center history + day/night + thresholds.
3. Dryback Lab VWC/shot-size/irrigation-event mode.
4. Fertigation stock-tank/injector and target-vs-result modes.
5. IPM Scout thresholds + repeated trap/zone trends.
6. Grow Planner visual timeline + stage tasks.
7. Pedigree graph + plant/selection IDs.
8. Shared CSV/JSON interchange and GrowLens import/export.
