# DTF Game Asset, Animation, and Audio Pipeline

## Blender source policy

Keep editable source assets separate from optimized runtime assets.

Recommended layout:

```text
art-source/
  blender/
  textures-source/
  audio-source/
runtime-assets/
  models/
  textures/
  animations/
  audio/
```

Do not overwrite the only editable `.blend` source with an export-oriented destructive cleanup pass.

## 3D naming convention

Use stable semantic names. Examples:

```text
CHR_SeedMan
ENV_GrowRoom_A
PRP_Pot_01
COL_GrowTable_A
SK_SeedMan
MAT_Leaf_Green
ANIM_SeedMan_Idle
ANIM_SeedMan_Run
```

Avoid names such as `Cube.047`, `Material.003`, or `Action.012` in approved runtime exports.

## Blender export checklist

Before export:

- correct scale and orientation,
- applied transforms where required,
- intentional origin/pivot,
- no accidental hidden geometry,
- no unused high-resolution source meshes in the runtime hierarchy,
- clean material slots,
- expected UV maps,
- animation actions named and bounded correctly,
- skeleton/bone names stable,
- collision proxies named explicitly,
- LOD policy documented where needed.

## Browser 3D shipping

Default runtime contract: GLB/glTF 2.0.

Optimize before shipping:

- prune unused data,
- deduplicate meshes/materials/textures,
- simplify meshes according to visible size,
- use Meshopt or another justified geometry-compression path,
- use KTX2/BasisU compressed textures when supported,
- verify animations after optimization,
- validate bounds, pivots, scale, material appearance, and collision in runtime.

Do not solve asset-origin or scale errors permanently with arbitrary runtime offsets when the source asset can be corrected.

## Unity import policy

For Unity targets:

- use one documented unit/scale convention,
- configure rig type explicitly,
- define animation clips rather than relying on anonymous frame ranges,
- use prefabs for runtime-ready compositions,
- separate source meshes from gameplay colliders,
- use appropriate texture compression per target platform,
- keep Addressables/asset-bundle strategy explicit if content size requires it.

## Unreal import policy

For Unreal targets:

- define skeletal vs static mesh imports intentionally,
- keep skeleton ownership stable,
- validate physics/collision assets,
- use named Animation Sequences/Blueprint state machines,
- establish LOD/Nanite policy intentionally rather than automatically,
- establish material instances instead of duplicating equivalent materials,
- establish Niagara usage with measurable performance budgets,
- document packaging target and delivery method before building large environments.

## Voice and ElevenLabs

Voice-generation requests should begin from a checked-in script source or structured dialogue data, not ad hoc generated audio with no text record.

Track for each generated line/batch:

- speaker/character,
- source text,
- intended emotion/delivery,
- voice/model identifier where permitted,
- generation date/version,
- output filename,
- normalization/edit status,
- license/provenance notes required by the project.

Never imitate a real person's voice without appropriate authorization.

## Audio runtime rules

Recommended categories:

```text
music
ambience
ui
sfx
voice
```

Games should provide master controls plus separate music and SFX/voice controls where the audio scope justifies them.

Normalize levels so one generated voice line, UI click, or effect cannot unexpectedly dominate the mix.

Browser games must handle autoplay restrictions correctly: initialize/resume audio from a valid user interaction rather than assuming playback is allowed on page load.
