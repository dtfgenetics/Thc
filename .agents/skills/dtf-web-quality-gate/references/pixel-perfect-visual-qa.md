# Pixel-Perfect Visual QA Reference

Use this reference to make customer-facing pages, games, tools, cards, dashboards, learning surfaces, and shared UI visually production-ready against approved design intent.

## Visual acceptance hierarchy
Use the strongest available reference in this order:
1. explicitly approved design or screenshot;
2. current design-system tokens/components plus approved page pattern;
3. known-good production baseline;
4. documented visual specification;
5. a best-fit implementation consistent with the rest of the product when no stronger reference exists.

Never invent a mismatched visual language merely to make a page look different.

## Verification loop
1. Identify the exact reference and target route/component.
2. Match viewport, theme, state, content, and device assumptions as closely as practical.
3. Stabilize nondeterministic content before comparison where possible.
4. Use supplied/current screenshots or other approved renders as evidence.
5. Compare reference and implementation with deterministic image diff/overlay tools when stable captures are available.
6. Classify differences by shared token, layout, typography, asset, or component cause.
7. Repair the causal shared layer instead of patching isolated pixels.
8. Recompare affected surfaces.
9. Repeat across required viewports.
10. Accept a new baseline only when the visual change is intentional and approved.

## Required visual checks
Inspect grid alignment, spacing, typography, borders/radii/shadows, focus treatment, icon sizing, image crop/aspect/resolution/loading, design-token consistency, container width/gutters, repeated-card consistency, touch targets, overlays, z-index, clipping/overflow, loading/empty/error/success states, animation layout shifts, and canvas/game HUD safe areas.

## Viewport matrix
When evidence/rendering access permits, validate narrow mobile around 360px, common mobile 390–430px, tablet around 768px when breakpoints apply, laptop 1280–1440px, and large desktop around 1920px for wide game/tool surfaces. Do not claim a viewport passed if it was not inspected.

## Deterministic image comparison policy
Baselines are test evidence, not decoration. Never update a baseline automatically because a comparison fails. Investigate changed regions before accepting them. Mask only genuinely nondeterministic regions and never mask broken UI, missing content, layout shifts, or first-party defects. Target zero unexplained visual difference; document any necessary rasterization tolerance.

## Design-system repair rule
When the same visual defect appears across multiple pages, fix the shared token/component/layout primitive and recheck affected consumers rather than patching every route separately.

## Routine-tool policy
Routine QA uses deterministic source/build checks, route/asset validation, approved screenshot/reference inspection, image-diff tools when available, and Lighthouse. Do not add Playwright or another browser automation dependency as a normal completion gate.
