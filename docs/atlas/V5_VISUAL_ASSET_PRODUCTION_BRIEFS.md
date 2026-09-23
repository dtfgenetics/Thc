# THC Living Plant Atlas V5 — Visual Asset Production Briefs

Updated: 2026-09-23

## Global production standard

All instructional visuals for the Plant Atlas are raster-first. Do not use SVG for instructional images, charts, infographics, microscopy plates, anatomy plates, or comparison visuals.

Preferred production formats:
- PNG for labeled plates, diagrams, transparent overlays and lossless review masters.
- WebP for optimized web delivery derivatives.
- JPEG only for photographic material where transparency is not required.

Minimum master size:
- 2400 px on the long edge.
- Prefer 3200–4800 px for labeled plates and macro references that will be zoomed.

Visual direction:
- scientific natural-history reference
- photoreal where the asset claims to show real plant appearance
- neutral lighting and realistic Cannabis morphology
- no decorative yellow cast
- no fantasy trichomes, impossible leaf venation or exaggerated resin effects
- avoid text baked into photographs unless necessary
- dense labels should remain in HTML when possible
- every baked label must pass text QA before approval

Every approved asset must receive a media-registry record with provenance and license fields before public use.

## Batch 1 — Leaf + gas exchange

### PA-LEAF-001 — Healthy fan leaf reference

Entity: `leaf-module`
Class: `photoreal-reference`

Required view:
- healthy mature Cannabis fan leaf
- full blade visible
- petiole visible
- realistic serrated margins
- clear leaflet separation
- neutral background or controlled botanical field background
- no visible nutrient/pest/stress symptoms

Purpose:
Establish a healthy baseline before symptom interpretation.

### PA-LEAF-002 — Leaf anatomy plate

Entity: `leaf-module`
Class: `labeled-botanical-plate`

Required structures:
- petiole
- rachis/common attachment region where appropriate
- leaflet
- leaf blade/lamina
- serrated margin
- primary and secondary venation
- adaxial surface
- abaxial surface

Keep explanatory paragraphs outside the image.

### PA-LEAF-003 — Leaf macro surface

Entity: `leaf-module`
Class: `macro-reference`

Required:
- realistic epidermal texture
- visible venation
- sufficient detail to bridge whole-leaf anatomy toward surface structures

### PA-STOMA-001 — Stomatal microscopy reference

Entity: `stomatal-surface`
Class: `microscopy-reference`

Required:
- identifiable stoma/guard-cell complex
- tissue identity recorded
- magnification or scale recorded when known
- source and license recorded

Never use an AI-generated image as measured microscopy evidence.

### PA-STOMA-002 — Open / closed stomata plate

Entity: `stomatal-surface`
Class: `labeled-botanical-plate`

Required:
- paired open and closed guard-cell states
- stomatal pore
- guard cells
- surrounding epidermal cells
- CO2-entry and water-vapor-exit arrows may be added as an educational overlay
- explicitly mark as illustrative, not a measured Cannabis specimen, unless based on sourced microscopy

### PA-STOMA-003 — Stomatal response sequence

Entity: `stomatal-surface`
Class: `animation-sequence`

Sequence:
1. open pore
2. decreasing guard-cell turgor
3. partial closure
4. closed pore

Use for future physiology/environment overlays.

## Batch 2 — Root + uptake

### PA-ROOT-001 — Healthy exposed root system

Entity: `root-system`
Class: `photoreal-reference`

Required:
- root crown
- primary/major structural roots
- lateral roots
- fine absorbing roots
- realistic pale/cream healthy-root appearance with natural variation
- no opaque soil block hiding architecture

### PA-ROOT-002 — Root architecture plate

Entity: `root-system`
Class: `labeled-botanical-plate`

Required labels:
- root crown
- lateral root
- fine root
- root tip
- absorbing zone
- root hair zone where scale permits

### PA-ROOT-003 — Root-to-shoot water pathway

Entity: `root-system`
Class: `process-diagram`

Show:
substrate/rhizosphere -> fine roots -> root vascular tissue -> stem xylem -> leaf veins -> mesophyll -> stomata -> atmosphere.

### PA-RTIP-001 — Root-tip macro reference

Entity: `root-tip`
Class: `macro-reference`

Required:
- root tip
- elongation region
- younger absorbing region

### PA-RTIP-002 — Root hair microscopy reference

Entity: `root-tip`
Class: `microscopy-reference`

Must record tissue, source, license and scale/magnification when available.

### PA-RTIP-003 — Root-tip anatomy plate

Entity: `root-tip`
Class: `labeled-botanical-plate`

Required:
- root cap
- apical meristem
- elongation zone
- differentiation/maturation zone
- root hairs

## Batch 3 — Flower + trichome bridge

### PA-FLOWER-001 — Female flower reference
Entity: `flower-anatomy`
Class: `photoreal-reference`

Show a botanically plausible unpollinated female inflorescence with visible bracts, sugar leaves and stigmas.

### PA-FLOWER-002 — Flower anatomy macro
Entity: `flower-anatomy`
Class: `macro-reference`

### PA-FLOWER-003 — Flower anatomy plate
Entity: `flower-anatomy`
Class: `labeled-botanical-plate`

Required:
- inflorescence axis
- bract
- pistillate flower
- stigma
- ovary/ovule location
- sugar leaf
- trichome-bearing surface

### PA-TRICH-001 — Trichome macro reference
Entity: `trichomes-resin`
Class: `macro-reference`

### PA-TRICH-002 — Capitate-stalked trichome microscopy
Entity: `capitate-stalked-trichome`
Class: `microscopy-reference`

### PA-TRICH-003 — Capitate-stalked trichome plate
Entity: `capitate-stalked-trichome`
Class: `labeled-botanical-plate`

Required:
- base
- stalk
- secretory head
- cuticular storage cavity/general gland-head boundary where appropriate
- avoid inventing cellular detail not supported by the reference source

### PA-TRICH-004 — Trichome gland-head 3D reference
Entity: `trichome-gland-head`
Class: `3d-representation`

Purpose:
Enable the future Flower -> Trichome -> Gland head -> Terpene Atlas transition.

## Acceptance checklist

Before any asset becomes `approved`:
- exact entity ID confirmed
- required asset class confirmed
- botanical plausibility reviewed
- all labels verified
- dimensions meet production minimum
- no watermark
- no accidental brand/text artifacts
- source and creator recorded
- license permits intended use
- illustrative vs measured status recorded
- plant stage and organ recorded
- microscopy scale/magnification recorded when known
- optimized web derivative created without deleting the master
- visual tested on desktop and mobile
