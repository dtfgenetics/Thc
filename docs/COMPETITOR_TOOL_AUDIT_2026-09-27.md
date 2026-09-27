# THC / DTF Tool Competitive Audit — Wave 1

Date: 2026-09-27

## Goal

Make the DTF / Teaching Healthy Cultivation tool suite easier to understand, faster to use on mobile, and more defensible than single-purpose cultivation calculators by combining three strengths:

1. **Fast first answer** — a new user should get useful output in one short interaction.
2. **Scientific context** — show assumptions, units, measurement quality, uncertainty, and evidence.
3. **Connected workflow** — measurements should connect to GrowLens, Grow Doc, lessons, records, and follow-up observations.

The target is not to copy competitor styling. It is to match or exceed the clarity of their first-use experience while preserving DTF's deeper education and recordkeeping advantage.

## Benchmarks reviewed

### Photone cannabis DLI calculator
Source: https://growlightmeter.com/calculators/cannabis/

What works:
- Very compact first interaction.
- Inputs are framed around the grower's actual question: flowering type, week/stage, CO2, photoperiod.
- Result is immediate and visually dominant.
- Educational explanation sits under the result instead of blocking it.

What DTF should keep / improve:
- Keep our canopy mapping, measurement-method context, variable-light schedule, saved surveys, comparison tools and evidence notes.
- Move the fastest PPFD → DLI result and target/reverse calculation above advanced mapping controls.
- Add a clearer “next measurement” action after the result.

### Coco for Cannabis grow-light calculator
Source: https://www.cocoforcannabis.com/grow-light-calculator/

What works:
- Inputs are tied to real purchasing and setup decisions.
- Preloaded fixtures reduce typing.
- Comparison tables make the tool useful for decisions, not just arithmetic.
- Methodology and testing protocol are explained.

What DTF should keep / improve:
- Add an optional fixture library only after our calculation contracts and source/version policy are defined.
- Preserve our stronger separation between measured, manufacturer-map and estimated inputs.
- Add comparison summaries that explain whether two maps are actually comparable.

### GrowVPD Pro / Hydro Lab VPD tools
Sources:
- https://growvpd.pro/widget/
- https://thehydrolab.tech/lighting/vpd-calculator-interactive

What works:
- Current condition is obvious.
- Nearby temperature/RH context is visual.
- Plain-language adjustment advice reduces interpretation burden.
- Leaf temperature is treated as meaningful context.

What DTF should keep / improve:
- Keep editable targets instead of pretending one universal VPD prescription fits every grow.
- Put the quick VPD answer first.
- Keep logger/profile analysis, but disclose it as advanced rather than making it compete with the first calculation.

### GrowDoc AI
Source: https://www.growdoc.ai/

What works:
- Extremely clear promise: upload photo → receive diagnosis.
- Optional advanced information does not block the basic workflow.
- The interface makes the first action obvious.

What DTF should keep / improve:
- Our differential reasoning, evidence-for/against, multi-image/video and longitudinal GrowLens context are stronger concepts than one-label diagnosis.
- The intake should never require optional details before a usable photo can be analyzed.
- First result needs a concise “most plausible / why / what to check next / safest next action” layer before deeper evidence.

### Grow Weed Easy problem library
Sources:
- https://www.growweedeasy.com/marijuana-symptoms
- https://www.growweedeasy.com/5-step-solution-to-most-cannabis-growing-problems

What works:
- Huge visual symptom library.
- Beginner-oriented language.
- Strong cross-linking from symptom → cause → correction.
- Users can browse even when they do not know the technical term.

What DTF should keep / improve:
- Add symptom-first browse paths alongside diagnosis.
- Connect every Grow Doc differential to the relevant Plant Health/IPM, pH/EC, environment and light references.
- Build image-backed comparison cards for commonly confused conditions.

### Leafly terpene / strain exploration
Sources:
- https://www.leafly.com/learn/cannabis-glossary/terpenes
- https://www.leafly.com/news/cannabis-101/find-which-weed-strain-is-best-for-you

What works:
- Strong visual vocabulary.
- Terpenes are connected to familiar aromas and common strains.
- Exploration is browse-first rather than textbook-first.

What DTF should keep / improve:
- Keep stricter evidence labels and avoid overstating health/effect claims.
- Add aroma-family filtering, plant-source examples, chemistry family, volatility/boiling-context caveats, and documented cannabis occurrence.
- Make the Terpene Atlas useful as both a visual explorer and a scientific reference.

### Cannabis Training University / Green Flower university-partner programs
Sources:
- https://cannabistraininguniversity.com/cannabis-courses/
- https://greenflower.utah.edu/cultivation/

What works:
- Clear course progression.
- Visible quizzes/exams/certificates.
- Career or competency outcome is stated up front.
- Students understand what completion means.

What DTF should keep / improve:
- Define course prerequisites, estimated effort, measurable objectives and assessment rules.
- Separate “lesson completed” from “competency demonstrated.”
- Make certification status, passing score, retake policy and evidence of mastery visible before enrollment/start.

## Competitive position

DTF is already broader than the single-purpose tools. The risk is that breadth currently creates cognitive load. The competitive advantage should be **connected cultivation reasoning**:

**Observe → Measure → Interpret → Diagnose → Learn → Record → Verify**

No benchmark reviewed combines this entire loop in one ecosystem.

## Priority backlog

### P0 — clarity and first-use speed
- Task-first Tools hub.
- Every tool gets a compact “Quick” mode above advanced controls.
- One primary CTA per viewport.
- Results appear beside or directly below the inputs on mobile.
- Advanced import/export/logger/profile features use progressive disclosure.
- Every result includes units, assumptions and one next step.
- Mobile tap targets and horizontal-scroll states are explicitly validated.

### P1 — cross-tool continuity
- Shared grow/room/plant/stage context.
- Save measurement to GrowLens from VPD, PPFD/DLI, pH and EC tools.
- Open Grow Doc with recent measurements attached when diagnosing.
- Deep-link from every result to the exact supporting THC lesson/reference.

### P1 — diagnostic differentiation
- Photo-only submission must work.
- Optional stage/media/pH/EC/environment remain optional.
- Concise first result followed by differential evidence.
- “What would change this conclusion?” and “What should I measure next?” sections.
- Follow-up photos tied to the same case.

### P1 — educational/certification polish
- Course map: prerequisite → objective → lesson → practice → assessment → certificate.
- Remove placeholder or draft-looking states from public navigation.
- Add progress and resume behavior.
- Add question-bank QA: difficulty, distractor quality, source, objective mapping, version.

### P2 — atlas differentiation
- Plant Atlas: anatomy search, lifecycle overlays, clickable structure → lesson → diagnosis relevance.
- Terpene Atlas: filters, comparison mode, occurrence/evidence labels, source citations.
- Connect strain/genetics pages to terpene records only where data is documented.

### P2 — credibility layer
- Visible methodology/source drawer in every scientific calculator.
- Calculation version and “last reviewed” metadata.
- Source-backed defaults; user-editable targets when literature is variable.
- Exported reports include assumptions and tool version.

## Wave 1 implemented

Branch: `tool-ux-benchmark-wave1-20260927`

- Tools hub now starts with common jobs rather than forcing users to decode the full suite.
- VPD quick calculator now supports an editable target band and gives immediate next-action guidance.
- VPD saved-profile and CSV logger workflows are preserved but moved behind an advanced disclosure.
- Deterministic validation now checks that the task-first hub and VPD progressive-disclosure contracts remain present.

## Next implementation wave

1. Apply the same Quick / Advanced hierarchy to PPFD/DLI.
2. Audit Grow Doc intake so a valid photo can always proceed without optional fields.
3. Rework Terpene Atlas around browse/filter/compare.
4. Standardize result cards across tools: **Result / Meaning / Confidence & assumptions / Next step / Save to GrowLens / Learn why**.
5. Add deterministic mobile layout assertions for tool headers, inputs, result cards and advanced disclosures.


## Wave 2 implemented

### PPFD / DLI Light Lab
- The first result now adds plain-language target-aware next-step guidance.
- Variable-light scheduling is preserved behind an advanced disclosure.
- Fixture calibration, survey records and canopy mapping remain available under a grouped advanced workspace.
- The quick workflow stays focused on PPFD, photoperiod, DLI, target interpretation and measurement quality.

### Terpene Atlas
- Added a browse-first entry point for users who know an aroma descriptor or common terpene but not the chemistry family.
- Quick filters include citrus, pine, floral, earthy, myrcene, limonene and pinene.
- Source and public mirrors remain synchronized so production validation can enforce parity.
- Existing scientific evidence, measured-population, sample-profile, comparison and safety sections remain intact.

### Grow Doc
Implementation is in the canonical diagnostic repository, PR dtfgenetics/Thc-dataset#311.
- Explicitly states that one clear photo is enough.
- Prioritizes affected-area imagery as the fastest start while keeping whole-plant capture valid.
- Keeps extra views and grow measurements optional.
- Simplifies the visible workflow to Add photo → Get result → Verify.
- Preserves ranked differentials, uncertainty, technical evidence, case history and reference workflows.

### Regression contracts added
- PPFD quick-result and progressive-disclosure markers.
- Terpene Atlas quick-browse markers and runtime behavior.
- Existing Terpene Atlas source/public mirror parity remains enforced.


## Wave 3 implemented

### pH Reference
- Keeps the quick meter-reading interpretation and visual scale first.
- Adds a context-aware next action for nutrient solution, container media, source water and runoff/drainage.
- Moves calibration history, CSV import/export, trend chart and local journal behind an advanced disclosure.

### EC / TDS
- Keeps EC ↔ µS/cm ↔ 500/700 ppm conversion immediately visible.
- Explicitly tells users to preserve EC as the primary measurement record and treat ppm as a display convention.
- Moves calibration history and the measurement journal behind an advanced disclosure.

### Water Quality Lab
- Reduces the first decision to pH, EC and alkalinity.
- Moves hardness and major-ion chemistry into an advanced report section without removing it.
- Moves saving, GrowLens integration, history comparison and CSV export into an advanced workflow.
- Quick result tells the user when to escalate from the basic water profile into full mineral chemistry.

### Production standard
The mandatory Tools UX standard now requires:
- minimum valid interaction first;
- dominant result before expert controls;
- meaning and limitations;
- one practical next action;
- progressive disclosure for history, profiles, imports/exports, calibration and specialist workflows;
- GrowLens / education continuity where supported;
- user-editable targets when evidence does not justify one universal biological threshold.

Deterministic validators now lock these contracts for pH, EC/TDS and Water Quality.
