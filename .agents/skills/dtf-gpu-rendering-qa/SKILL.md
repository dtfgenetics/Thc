---
name: dtf-gpu-rendering-qa
description: GPU rendering, upscaling, frame-generation, neural-rendering, and image-quality QA for DTF desktop 3D games using official engine integrations plus experimental swapper tools such as DLSS 5 Swapper.
---

# DTF GPU Rendering QA

Use this skill with `dtf-game-production` for desktop 3D projects where rendering cost, DLSS, FSR, XeSS, frame generation, ray reconstruction, neural rendering, dense foliage, volumetrics, particles, reflections, or high-fidelity lighting materially affect performance.

## Non-negotiable rule

Do not make DLSS 5 Swapper, a DLL injector, or any unofficial swapping utility a production dependency. These tools are QA and compatibility experiments only. Shipping builds must use supported engine/vendor integrations and retain a working fallback rendering path.

## Trigger

Run this skill when any of the following is true:

- a Unity or Unreal game is GPU-bound,
- a game adds ray tracing, expensive post processing, volumetrics, dense foliage, particles, or high-resolution assets,
- DLSS, FSR, XeSS, frame generation, ray reconstruction, or neural rendering is being evaluated,
- a user reports reconstruction artifacts, ghosting, unstable foliage, blurry HUDs, frame pacing problems, or vendor-specific crashes,
- a DTF 3D game needs a performance preset matrix before release.

Do not apply DLL-swapper workflows to browser/WebGL games.

## Required workflow

1. Resolve the canonical game repository and engine using `dtf-game-production` and `dtf-game-canonical-release`.
2. Establish a clean native-resolution baseline before enabling any upscaler or frame-generation feature.
3. Record engine version, render pipeline, game build SHA, GPU, driver version, OS, output resolution, and graphics preset.
4. Create or identify one deterministic stress scene/save state that exposes the expensive visual systems.
5. Benchmark native rendering first.
6. Test supported official DLSS/FSR/XeSS paths one variable at a time.
7. Only after the clean matrix exists, use DLSS 5 Swapper or similar tools for experimental compatibility comparisons when useful.
8. Restore the clean runtime after every swapper experiment and re-run the native baseline.
9. Keep swapper results clearly separated from shipping configuration in reports.

## Minimum matrix

For supported desktop 3D builds, test as applicable:

- Native / frame generation off
- Native + engine AA
- Upscaling Quality
- Upscaling Balanced
- Upscaling Performance
- Frame generation off vs on
- Ray reconstruction or neural rendering off vs on

Do not combine several newly enabled technologies in the first comparison. Isolate the source of regressions.

## Required measurements

Collect:

- average FPS,
- 1% low FPS,
- frame-time consistency,
- GPU utilization,
- VRAM usage,
- render/output resolution,
- input-latency observations,
- ghosting and disocclusion,
- foliage/particle stability,
- HUD and text clarity,
- transparent-material behavior,
- motion-vector artifacts,
- reflection/lighting stability,
- crashes, hangs, or driver resets.

## Visual stress requirements

The test route should intentionally include the game's expensive visuals where present: dense vegetation, animated cannabis foliage, particles, smoke/fog/volumetrics, transparent materials, reflective surfaces, dynamic lights, combat VFX, animated characters, and post-processing.

Use the same camera path or repeatable gameplay route between configurations whenever practical.

## DLSS 5 Swapper protocol

When an unofficial swapper is useful for QA:

1. Preserve or verify a clean restore path before changing files.
2. Record the exact game build and swapped component versions.
3. Test only on an offline/local build unless the title explicitly supports the modification.
4. Do not bypass anti-cheat, integrity validation, launcher protection, signatures, or online-service restrictions.
5. Make one component change at a time.
6. Capture screenshots/video plus performance evidence.
7. Restore original files.
8. Re-test the clean build to prove restoration.
9. Never commit or redistribute swapped third-party binaries without explicit license review.

## Shipping architecture

Preferred order:

`native renderer -> official engine integration -> optional DLSS/FSR/XeSS -> graphics presets -> deterministic QA -> experimental swapper comparison`

A game must launch and remain playable when vendor-specific reconstruction is unavailable or disabled.

## Browser/WebGL rule

For browser games, solve rendering cost with browser-appropriate techniques instead: resolution scaling, LOD, compressed textures, GLB/glTF optimization, draw-call reduction, culling, pooled effects, shader simplification, WebGL/WebGPU profiling, and asset budgets. Do not attempt DLSS Swapper injection.

## Release gate

A 3D desktop game using optional GPU reconstruction passes this skill only when:

- native rendering works,
- optional reconstruction can be disabled,
- a fallback path exists,
- UI remains readable,
- artifacts are reviewed in motion,
- performance evidence is captured,
- plugin/render versions are documented,
- clean restoration from any swapper test is verified,
- experimental results are not confused with the shipping build.

## Completion report

Report:

- game/repository/engine,
- build SHA,
- GPU/driver/OS,
- baseline results,
- official upscaler results,
- frame-generation results,
- swapper experiment results if used,
- image-quality regressions,
- performance gains/losses,
- fallback behavior,
- shipping recommendation,
- unresolved blockers.

Use `.agents/skills/dtf-game-production/references/gpu-upscaling-qa.md` for the detailed matrix and engine-specific reminders.
