# Plant Atlas V4 production model contract

The photoreal Plant Atlas renderer expects the approved production specimen at:

`/atlas/models/cannabis-specimen-v1.glb`

Do not replace the live V3 procedural renderer until this asset has passed visual, botanical, performance, licensing, and interaction QA.

## Required specimen

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

## Interaction contract

`/atlas/data/hotspots-v4.json` stores normalized 0–1 anatomy anchors against the loaded model bounds. Calibrate every anchor after the final GLB is locked. The seven required interactive systems are:

1. root-system
2. stem-vascular
3. nodes-branching
4. leaf-module
5. flower-anatomy
6. trichomes-resin
7. reproductive-biology

Each system must remain selectable by mouse, touch, and the existing anatomy focus controls. Selection must focus the camera, show a persistent anatomy label, populate the explanatory inspector, and preserve the existing deep link into the detailed Atlas module.

## Release gate

Before wiring V4 into `/atlas/index.html`:

1. Record model source, creator, license, attribution requirements, and any modification rights in this directory.
2. Validate plant anatomy against the educational copy and remove any obviously inaccurate or impossible geometry.
3. Calibrate `hotspots-v4.json` against the exact final GLB.
4. Test rotate, pinch/wheel zoom, tap/click selection, camera focus, reset, reduced-motion behavior, and mobile layout.
5. Verify acceptable loading and frame rate on a mid-range Android phone as well as desktop.
6. Run the V3 regression suite and V4 validation so the public-route mirror stays synchronized.

The renderer intentionally falls back to the existing V3 atlas when the production GLB cannot be loaded.