# GPU Upscaling and Neural Rendering QA

Use this reference for desktop 3D projects where DLSS, FSR, XeSS, frame generation, ray reconstruction, or neural rendering may materially affect image quality or performance.

## Principle

Upscaling is an optimization and compatibility layer, not permission to ship an unoptimized renderer. Establish a native-rendering baseline first. Do not make an unofficial swapper or injector a production dependency.

## Tool roles

- Official engine integrations are the preferred shipping path.
- NVIDIA DLSS, AMD FSR, and Intel XeSS should be treated as parallel optional capabilities when the engine and target platform support them.
- DLSS 5 Swapper and similar community tools are experimental QA/modding aids only. Use them to explore compatibility, compare library behavior, and reproduce user-side configurations; never require them for a release build.
- Keep all third-party binaries out of source control unless their license explicitly permits redistribution and the project has documented provenance.

## Required baseline matrix

For each supported desktop 3D build, capture at minimum:

1. Native resolution, no frame generation.
2. Native resolution with the engine's standard anti-aliasing path.
3. Quality-mode upscaling where supported.
4. Balanced-mode upscaling where supported.
5. Performance-mode upscaling where supported.
6. Frame generation off/on as separate tests where supported.
7. Ray reconstruction/neural rendering off/on as separate tests where supported.

Never combine multiple new rendering technologies in the first comparison. Isolate variables.

## Metrics

Record:

- average FPS,
- 1% low FPS,
- frame-time consistency,
- GPU utilization,
- VRAM usage,
- render resolution and output resolution,
- input-latency observations,
- visible ghosting/disocclusion,
- foliage and particle stability,
- HUD/text clarity,
- transparency quality,
- motion-vector artifacts,
- lighting/reflection stability,
- crashes or driver resets.

## Visual stress scenes

Every qualifying game should maintain at least one repeatable stress scene or save state containing the game's expensive visual features. For DTF projects this may include dense foliage, particles, volumetrics, transparent materials, animated characters, reflective surfaces, post-processing, dynamic lights, and combat VFX.

The same camera path or reproducible gameplay route should be used across settings whenever practical.

## Engine guidance

### Unreal Engine

Prefer official vendor plugins or engine-supported integrations. Keep renderer settings versioned and document required engine/plugin versions. Validate temporal data such as motion vectors, reactive masks, transparency, particles, foliage, and HUD composition because these commonly expose reconstruction artifacts.

### Unity

Prefer supported Unity/vendor packages appropriate to the active render pipeline. Record the pipeline (Built-in, URP, or HDRP), package versions, graphics API, and platform limitations. Do not assume feature parity between pipelines.

### Browser/WebGL

Do not apply DLSS Swapper workflows. Browser games instead require WebGL/WebGPU-appropriate resolution scaling, dynamic resolution where supported, asset optimization, LOD, texture compression, draw-call control, and engine/browser profiling.

## Compatibility policy

A game must remain launchable when optional vendor-specific reconstruction is unavailable. Provide a safe fallback path. Do not lock core gameplay to NVIDIA-only, AMD-only, or Intel-only hardware unless the product explicitly targets that hardware.

## DLSS 5 Swapper experiment protocol

When using DLSS 5 Swapper or another unofficial swapper during QA:

1. Back up the clean game/runtime state or rely on the tool's verified restore mechanism.
2. Record game build, engine version, GPU, driver version, Windows version, and the exact swapped component versions.
3. Perform the native baseline before any swap.
4. Test one change at a time.
5. Capture screenshots/video and frametime evidence.
6. Restore the original files after the experiment.
7. Re-run the clean configuration to verify restoration.
8. Never publish swapped third-party DLLs as part of the DTF build.
9. Treat anti-cheat, launcher integrity checks, signatures, and online-service compatibility as hard constraints; do not inject into protected online titles.

## Release gate

A desktop 3D game using upscaling passes this gate only when:

- native rendering is functional,
- at least one vendor-neutral or fallback path exists,
- optional upscaling can be disabled,
- UI remains readable,
- reconstruction artifacts are within acceptable limits,
- performance evidence is recorded,
- renderer/plugin versions are documented,
- experimental swapper results are clearly separated from shipping configuration.
