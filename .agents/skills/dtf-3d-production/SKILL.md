---
name: dtf-3d-production
description: Create, repair, optimize, validate, and ship Blender/3D assets for DTF games, site experiences, educational interactives, product visuals, and future 3D systems. Use for Blender, GLB/glTF, generated 3D intake, retopology, UVs, baking, PBR materials, rigging, animation, collision, LOD, Geometry Nodes, 3D asset QA, and browser-runtime delivery.
compatibility: DTF system orchestrator plus Blender/MCP or Blender Python access. May use connected image-to-3D or AI 3D generation tools as starting inputs, but production acceptance requires DTF QA and canonical repository integration.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF 3D Production

Use this skill as the 3D specialist lane under `dtf-system-orchestrator`.

It does not replace project ownership, release policy, game production, web quality, or publishing skills. Resolve the canonical project/repository first, then use this skill for the 3D portion of the work.

## Authority and handoffs

Before editing or generating 3D:

1. Read repository `AGENTS.md` and project/source-of-truth rules.
2. Resolve canonical project/repository/source path with `dtf-system-orchestrator` and the current project/game/site registries.
3. For game work, use the canonical game source map before touching an integration copy.
4. Use `dtf-game-production` / `dtf-game-portfolio-upgrade` for gameplay ownership.
5. Use `dtf-game-asset-production` / ingest/batch skills for the broader asset lifecycle.
6. Use `dtf-web-quality-gate` for visitor-facing runtime, responsive, accessibility, Lighthouse, visual, and live-parity checks.
7. Use `dtfseeds-production-publishing` / repair skills for publication and production recovery.

## Core rule

A generated or imported 3D object is not production-ready merely because it looks acceptable in one render.

Every important asset must be:

`project-resolved -> inspected -> authored/generated -> cleaned -> optimized -> validated -> exported -> re-imported/runtime-tested -> persisted -> integrated -> live-verified when public`

## Tool routing

### Existing Blender scene or exact edit
Prefer a Blender MCP bridge with structured scene/object/material/node/animation operations.

Use Blender Python (`bpy`) as a fallback when:
- the structured tool lacks the operation;
- deterministic batch work is safer/faster in code;
- a reusable script is itself a deliverable.

### 2D reference to 3D starting point
Connected image-to-3D tools such as `to3D` may generate glTF/FBX/OBJ/STL starting assets.

For DTF game/web work prefer glTF/GLB as the handoff format.

Generated mesh intake is mandatory before production use.

### AI 3D generation/retexturing
Connected generation systems such as fal-compatible 3D workflows may accelerate:
- blockout;
- rigid props;
- texture variants;
- PBR retexturing;
- concept exploration.

They do not bypass Blender cleanup, topology review, UV review, budget checks, or runtime validation.

### Procedural assets
Prefer Geometry Nodes, modifiers, curves, instancing, or deterministic Python for:
- modular environments;
- paths/roads;
- fences;
- repeated props;
- vegetation/scatter;
- parametric variants.

## Mandatory preflight

Before modifying an existing Blender source, capture or record where applicable:
- Blender version;
- scene/file identity;
- unit system;
- render engine;
- collections and target objects;
- object dimensions/transforms;
- mesh/triangle counts;
- modifiers;
- UV maps;
- materials/textures;
- armatures/actions;
- baseline viewport/reference image.

Do not begin destructive edits when scene identity or target object is uncertain.

## Generated-asset quarantine

AI/image-generated 3D enters a quarantine/intake state.

Inspect:
- disconnected fragments;
- internal shells;
- self-intersections;
- holes/non-manifold defects;
- inverted normals;
- excessive tessellation;
- melted/ambiguous detail;
- duplicate surfaces;
- unusable UVs;
- excessive/duplicate materials;
- broken texture paths;
- bad origin, scale, or orientation.

Classify the result:
- `PASS` — viable production candidate;
- `REPAIR` — useful after cleanup;
- `RETOPO` — visual reference is useful but topology should be rebuilt;
- `REJECT` — regeneration/rebuild is safer or faster.

Never force a bad generated mesh through the pipeline simply because generation consumed time or credits.

## Modeling and topology

- silhouette first;
- remove accidental internal/floating geometry;
- avoid degenerate faces and unexplained non-manifold defects;
- use deformation-friendly topology for characters;
- use bevels/highlight control intentionally;
- preserve instances for repeated assets where supported;
- do not carry invisible geometry without a reason;
- keep pivots/origins aligned to gameplay behavior.

Retopology is strongly preferred when:
- the asset deforms;
- generated topology is chaotic;
- triangle density is highly uneven;
- baking high-to-low detail is planned;
- UVs cannot be repaired cleanly;
- future editing/reuse is expected.

## UV / texture / PBR

Before final export:
- verify the active UV map;
- fix unintended overlap;
- use appropriate texel density and island padding;
- minimize unique material count;
- use portable metallic/roughness PBR where possible;
- verify Base Color, Roughness, Metallic, Normal, Alpha/Emission where used;
- keep non-color texture handling correct;
- bake unsupported Blender-only procedural looks when portability requires it;
- size textures to expected on-screen usage rather than source-art ambition.

For browser assets, evaluate KTX2/Basis Universal or other target-supported texture compression rather than shipping oversized raw textures by default.

## Rigging and animation

Generated characters are never assumed rig-ready.

Verify:
- logical armature hierarchy;
- rest pose and transforms;
- weight quality at extreme poses;
- action names and clip ranges;
- loop seams;
- interpolation;
- root motion behavior;
- exported deformation after re-import.

Remove unintended keys/actions from runtime exports.

## Collision and LOD

Collision should normally be simpler than render geometry.

Prefer box/sphere/capsule/convex/low-poly proxy collision when it meets gameplay needs.

Use detailed mesh collision only when required.

For expensive/repeated assets, use intentional LODs:
- `lod0` close;
- `lod1` medium;
- `lod2` far.

LOD reduction must preserve silhouette, pivot, major color blocks, and gameplay footprint.

## DTF naming and manifest

Suggested runtime naming:
`<project>_<asset>_<variant>_lod<n>`

Examples:
- `seedman_fire_powerup_lod0`
- `weedopolis_grow_tent_lod0`
- `highland_kief_cave_lod1`

Each shipped 3D asset should be able to report:
- project ID;
- source `.blend` or canonical editable source;
- runtime `.glb`/`.gltf`;
- preview/reference image;
- dimensions;
- triangle count;
- material count;
- texture set and resolutions;
- animations;
- collider;
- LODs;
- source/license for external material;
- QA state;
- repo/storage/public usage locations.

## Browser shipping pipeline

Default browser contract:

1. author/repair in Blender;
2. export GLB/glTF 2.0;
3. validate file structure;
4. optimize/prune/deduplicate where safe;
5. apply geometry compression when appropriate;
6. apply texture compression when supported;
7. inspect optimized result;
8. import into a clean Blender scene when practical;
9. load in the real target runtime;
10. verify scale, pivot, materials, animation, collision, LOD and visual result.

Useful supporting tooling includes Khronos glTF validation, glTF Transform, Meshopt/meshoptimizer, and KTX2/Basis workflows when available in the execution environment.

Never optimize destructively over the only editable source.

## Pass/fail gates

### Scene gate
PASS only when target objects/dependencies are understood and no unexplained missing resources remain.

### Mesh gate
PASS only when topology, normals, manifold state, triangle budget, origin and transforms are acceptable for the asset's purpose.

### UV/material gate
PASS only when UVs, texture links, material count, portable shader behavior and color-space handling are acceptable.

### Rig/animation gate
When applicable, PASS only when deformation and intended clips are visually verified.

### Export gate
PASS only when the runtime file exists and includes the intended objects/materials/animations without accidental helpers/cameras/lights.

### Clean re-import gate
For important assets, import the runtime file into a clean scene and verify hierarchy, scale, orientation, materials, pivots and animation.

### Runtime gate
PASS only when the real target game/page loads and uses the asset correctly.

### Live gate
For public work, follow `dtf-web-quality-gate` and publishing skills and verify the exact visitor-facing route after deployment.

## DTF web QA rule

Do not introduce Playwright as the default/fallback DTF web or game QA dependency.

Use the existing `dtf-web-quality-gate` contract: deterministic application tests, HTTP/resource checks, Lighthouse or equivalent auditing, direct browser inspection, screenshot/image comparison, and targeted interaction checks.

## Blender Python safety

When `bpy` is necessary:
- operate on explicit objects/collections;
- prefer direct data APIs over fragile UI context;
- make batch scripts idempotent where practical;
- never clear the entire scene unless explicitly intended;
- log created/modified/deleted objects;
- validate after execution;
- do not read unrelated files, secrets, browser data, or credentials.

Review downloaded Blender scripts/add-ons before execution.

## Completion evidence

For completed 3D work report:
- canonical project/repository;
- source asset path;
- runtime asset path;
- dimensions;
- triangle/material/texture counts;
- animations/collision/LODs;
- repairs/optimization performed;
- validation results;
- clean re-import result;
- runtime result;
- deployment/live verification result if applicable;
- remaining blockers.

A render alone is never completion evidence.
