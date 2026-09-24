# Plant Atlas Trichome Microscopy Source Review

Updated: 2026-09-23

## Goal

Fill the measured microscopy classes for:
- `trichomes-resin`
- `capitate-stalked-trichome`
- `trichome-gland-head`

The Atlas must distinguish measured microscopy from explanatory illustration. AI-generated or generic botanical imagery cannot occupy a measured microscopy slot.

## Candidate A — Livingston et al. 2020 / PLOS ONE

Article:
- *Characterization of the Cannabis sativa glandular trichome proteome*
- DOI: 10.1371/journal.pone.0242633
- PLOS ONE
- Open-access PLOS license / reuse with attribution according to the article terms.

Figure 1:
- panel A: SEM micrograph of a capitate-stalked glandular trichome
- panel B: fluorescence microscopy of a glandular trichome head / stipe region
- panel C: SEM micrograph showing continuity between epidermal layer and trichome stalk
- panel D: fluorescence microscopy of an intact glandular trichome head

Why it is strong:
- Cannabis-specific.
- Explicit capitate-stalked glandular-trichome identity.
- Multiple imaging modalities.
- Figure descriptions distinguish head, stalk, stipe/disc-cell region and cuticular remnants.
- PLOS exposes a larger PNG and original TIFF from the article interface.

Status: **preferred measured source; original-file ingestion still required**

Before registration:
1. Fetch the original TIFF or publisher-original image.
2. Preserve DOI, figure number and panel identity.
3. Record scale-bar information if present in the original.
4. If a panel is cropped from the composite, record the crop as a derivative and preserve attribution.
5. Do not treat fluorescence intensity as quantitative metabolite concentration without the study's validated method.

Potential mapping:
- PA-CST-001 → Fig. 1A or 1C SEM
- PA-GLAND-001 → Fig. 1B or 1D fluorescence microscopy
- PA-TRICH-002 → a representative figure/panel showing intact Cannabis glandular trichomes

## Candidate B — Plants 2025, Bracts, Buds, and Biases

Article:
- *Bracts, Buds, and Biases: Uncovering Gaps in Trichome Density Quantification and Cannabinoid Concentration in Cannabis sativa L.*
- Plants 2025
- CC BY 4.0

Useful figures include:
- high-magnification stalked-capitate trichomes on bract surfaces
- immature glandular trichomes on sugar leaves
- whole-flower/bract context images

Status: **secondary measured/macro source candidate**

Use only after retrieving the original publisher image and retaining figure-level provenance.

## Production decision

Owned explanatory plates are allowed to fill labeled-botanical-plate classes now:
- PA-TRICH-003
- PA-CST-002
- PA-GLAND-002

Measured microscopy classes remain open until original-resolution publisher/source files are ingested and validated.

No microscopy slot is considered complete based solely on a screenshot, article preview, or an upscaled web composite.
