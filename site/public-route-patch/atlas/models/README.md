# Plant Atlas V4 model contract

Plant Atlas V4 is complete without a downloaded model: it ships with a built-in high-detail PBR botanical specimen (`procedural-pbr`) so the interactive anatomy, camera focus, explanations, accessibility, and mobile behavior do not fail when an external asset is absent.

An approved photoreal production specimen can replace the built-in visual source automatically through `model-manifest-v4.json`. The preferred target remains:

`/atlas/models/cannabis-specimen-v1.glb`

The external asset is therefore a **visual fidelity upgrade**, not a runtime dependency.

## Required external specimen

- glTF 2.0 binary (`.glb`), Y-up, upright, centered, and consistently scaled.
- One complete mature female Cannabis sativa specimen from apical flower through the exposed root system.
- No pot, opaque soil block, stand, text, labels, watermark, or background geometry.
- Botanically believable main stem, lateral branches, nodes/internodes, petioles, serrated fan leaves, sugar leaves, female inflorescences, bracts, stigmas, and a visible fibrous root architecture.
- Silhouette and spacing must leave the major anatomy readable from multiple viewing angles.

## Materials and web budget

- PBR materials with physically plausible base color, roughness, normal detail, and ambient occlusion where useful.
- Foliage transparency must render correctly from both sides without excessive overdraw.
- Initial target: roughly 80k–250k visible triangles after optimization. Higher-detail source files may be retained outside the web build.
- Prefer 2K production textures for the first web release; use higher-resolution sources only to generate optimized derivatives.
- Aim for an initial GLB transfer size below 25 MB. If the approved source is larger, optimize with Meshopt/Draco geometry compression and KTX2/Basis textures before public deployment.
- Avoid dozens of tiny materials and textures; batch by botanical surface where practical.

## Manifest activation

`model-manifest-v4.json` controls the source:

- `preferredModel.enabled: false` — use the built-in PBR specimen and do not request the GLB.
- `preferredModel.enabled: true` — attempt the approved GLB first; if loading fails, V4 automatically returns to the built-in PBR specimen.

Before enabling the external model, record creator/source, license, attribution requirements, and modification rights in this directory. Do not enable an asset whose redistribution rights are uncertain.

## Interaction contract

`/atlas/data/hotspots-v4.json` stores normalized 0–1 anatomy anchors against whichever specimen is active. V4 currently maps fourteen inspectable regions, including the seven primary systems and finer structures such as root tips, the shoot apex, petioles, leaf venation, bracts, sugar leaves, stigmas, and glandular trichomes.

Every primary system remains selectable by mouse, touch, keyboard-accessible focus buttons, and the existing anatomy controls. Selection must focus the camera, show a persistent anatomy label, populate explanatory copy, and preserve the deep link into the detailed Atlas module.

## External GLB release gate

Before setting `preferredModel.enabled` to `true`:

1. Record model source, creator, license, attribution requirements, and modification rights.
2. Validate the anatomy against the educational copy and reject obviously impossible geometry.
3. Confirm the exposed root system is visible and not hidden inside opaque soil or a pot.
4. Calibrate all normalized hotspot anchors against the exact final GLB.
5. Test rotate, pinch/wheel zoom, click/tap selection, camera focus, reset, keyboard controls, reduced-motion behavior, and mobile layout.
6. Verify acceptable loading and frame rate on a mid-range Android phone as well as desktop.
7. Run `npm run validate:plant-atlas:v4` and the complete GrowLens verification suite.

If any external-model gate fails, keep the manifest disabled. The built-in PBR specimen remains the production-safe model.
