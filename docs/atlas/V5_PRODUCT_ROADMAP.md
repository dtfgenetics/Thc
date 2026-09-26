# THC Living Plant Atlas V5 — Product Build Roadmap

Updated: 2026-09-23

## Product goal

Turn /atlas/ into a viewer-first, multi-scale Cannabis plant-science workspace where the plant itself is the primary navigation surface. Preserve the 16-system science model, 32 semantic anatomy targets, child routes, diagnostic caution language, Terpene Atlas bridge, and GrowLens integration.

## V5 foundation now implemented

- Explorer and Research detail modes.
- Scientific layer controls: Anatomy, Physiology, Environment, Diagnostics, Development.
- Unified command search across anatomy structures and science systems.
- Ctrl/Cmd+K search shortcut.
- Biological-scale breadcrumb scaffolding in the inspector.
- Inspector tabs for Overview, Function, Observe, Measurements, and Evidence.
- Mobile inspector bottom-sheet behavior.
- Source/public-route mirror synchronization.
- Deterministic V4 validator coverage for the V5 workspace files and wiring.

## Production milestones

### P0 — Canonical workspace
- Keep /atlas/ as the canonical specimen-first route.
- Keep /learn/atlas/ as the lesson library until deliberate migration.
- Consolidate legacy V3/V4/V5 CSS and JS after feature parity tests.
- Preserve all existing child routes and direct links.

### P1 — Production botanical specimen
The procedural PBR plant becomes fallback only. Add /atlas/models/cannabis-specimen-v1.glb as the preferred licensed production asset.

Required semantic model groups:
- root-crown
- primary-root
- lateral-roots
- fine-roots
- main-stem
- branches
- nodes
- internodes
- petioles
- fan-leaves
- leaflets
- leaf-margins
- leaf-venation
- apical-meristem
- axillary-buds
- preflowers
- inflorescences
- bracts
- sugar-leaves
- stigmas
- trichome-bearing-surfaces

Performance target: retain the existing 25 MB initial model transfer ceiling; use texture compression/LOD where needed and validate on a mid-range Android device.

### P2 — Multi-scale navigation
Implement explicit transitions:
- whole plant -> organ -> tissue -> microscopic structure
- flower -> bract -> trichome -> gland head -> secretory anatomy -> terpene chemistry
- leaf -> leaflet -> epidermis -> stomata
- stem -> cross-section -> xylem/phloem
- root -> lateral root -> root tip -> root hair -> rhizosphere

### P3 — Visual media registry
Create a machine-readable asset registry keyed by Atlas structure/system ID.

Asset classes:
1. photoreal healthy reference
2. macro reference
3. microscopy reference
4. labeled botanical plate
5. process diagram
6. diagnostic comparison
7. animation/sequence
8. 3D representation

Every media record should carry source, creator, license, capture type, plant stage, organ, scale/magnification where relevant, and whether the asset is illustrative or measured.

### P4 — Process and environment overlays
First production overlays:
- water transport/transpiration
- xylem/phloem transport
- carbon/source-sink flow
- stomatal gas exchange
- root nutrient uptake
- light/PPFD
- temperature
- RH/VPD
- airflow

### P5 — Development timeline
Add Seed -> Germination -> Seedling -> Vegetative -> Transition -> Reproductive Development as a persistent stage context. Later support stage-specific specimen models/morph targets.

### P6 — Comparison workspace
Support two-state comparison for:
- healthy vs stressed
- vegetative vs flowering
- young vs mature leaf
- male vs female reproductive structures
- healthy vs oxygen-stressed roots
- open vs closed stomata
- unpollinated vs pollinated flower
- trichome developmental states

### P7 — Observation/diagnostic training
Build an observation-first practice mode tied to Atlas entities and GrowLens:
- tissue and canopy position
- pattern/distribution
- color and texture
- progression
- stage
- environmental/root-zone context

Never treat a visible symptom as proof of a single cause.

### P8 — Evidence graph
Give each structure/system stable Atlas IDs and relationships to:
- functions
- processes
- measurements
- environmental variables
- observations
- diagnostic differentials
- lessons
- citations
- media assets
- Terpene Atlas compounds where appropriate

### P9 — Context-aware Atlas assistant
Only after the ontology/evidence graph is stable. The assistant must know the selected Atlas entity and ground explanations in approved Atlas/encyclopedia sources rather than acting as a generic chatbot.

## Definition of done for V5

V5 is not complete merely because the homepage looks better. It is complete when the canonical route has a production botanical specimen, unified viewer/navigation/inspector workspace, multi-scale transitions, structured visual media, responsive mobile interaction, evidence-linked content, deterministic validation, accessibility checks, and production smoke verification across representative child routes.
