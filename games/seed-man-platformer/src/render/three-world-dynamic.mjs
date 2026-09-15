import * as THREE from 'three';
import { createThreeWorldRenderer as createBaseThreeWorldRenderer, supportsSeedManWebGL } from './three-world.mjs';
import { gameRectToWorldBox } from './three-world-state.mjs';

export const DYNAMIC_PLATFORM_RUNTIME = 'seed-man-three-dynamic-platforms-v1';

const SURFACE_COLORS = Object.freeze({
  grass: Object.freeze({ base:0x426b45, top:0x9ad369 }),
  dirt: Object.freeze({ base:0x6d5136, top:0xa77a4b }),
  wood: Object.freeze({ base:0x6f4b2e, top:0xbd8953 }),
  rock: Object.freeze({ base:0x565b59, top:0x808985 }),
  stone: Object.freeze({ base:0x565c63, top:0x8a939b }),
  sand: Object.freeze({ base:0xb87842, top:0xe1ad69 }),
  ice: Object.freeze({ base:0x4f829b, top:0xc9f4ff }),
  metal: Object.freeze({ base:0x3c4a52, top:0x7a929c })
});

function isDynamicPlatform(platform) {
  return Boolean(platform?.motion || platform?.breakaway || platform?.conveyor || platform?.bounce || platform?.__seedRuntimeAdded);
}

function surfacePalette(surface) {
  return SURFACE_COLORS[surface] || SURFACE_COLORS.grass;
}

function createPlatformMesh(platform, worldHeight, pixelsPerUnit) {
  const box = gameRectToWorldBox(platform, worldHeight, { pixelsPerUnit, depth:0.85, z:0 });
  const palette = surfacePalette(platform.surface);
  const root = new THREE.Group();
  root.name = `seed-man-dynamic-platform-${platform.id || 'unknown'}`;

  const baseGeometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
  const baseMaterial = new THREE.MeshStandardMaterial({ color:palette.base, roughness:0.86 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  root.add(base);

  const capHeight = Math.min(0.12, Math.max(0.055, box.size.y * 0.28));
  const capGeometry = new THREE.BoxGeometry(box.size.x + 0.03, capHeight, box.size.z + 0.04);
  const capMaterial = new THREE.MeshStandardMaterial({ color:palette.top, roughness:0.7 });
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = box.size.y / 2 - capHeight / 2 + 0.012;
  cap.position.z = 0.025;
  root.add(cap);

  root.position.copy(new THREE.Vector3(box.position.x, box.position.y, box.position.z));
  root.userData.platformId = platform.id;
  root.userData.ownedGeometry = [baseGeometry, capGeometry];
  root.userData.ownedMaterial = [baseMaterial, capMaterial];
  return root;
}

function disposePlatformMesh(root) {
  for (const geometry of root?.userData?.ownedGeometry || []) geometry.dispose?.();
  for (const material of root?.userData?.ownedMaterial || []) material.dispose?.();
}

function setPlatformPosition(root, platform, worldHeight, pixelsPerUnit) {
  const box = gameRectToWorldBox(platform, worldHeight, { pixelsPerUnit, depth:0.85, z:0 });
  root.position.set(box.position.x, box.position.y, box.position.z);
  root.visible = platform.__runtimeHidden !== true;
}

export function createThreeWorldRenderer(options = {}) {
  const base = createBaseThreeWorldRenderer(options);
  if (!base) return null;

  let dynamicGroup = null;
  let dynamicMeshes = new Map();
  let levelRef = null;
  let worldHeight = 540;
  let pixelsPerUnit = 80;

  function ensureDynamicGroup() {
    if (dynamicGroup) return dynamicGroup;
    dynamicGroup = new THREE.Group();
    dynamicGroup.name = DYNAMIC_PLATFORM_RUNTIME;
    dynamicGroup.userData.dynamicPlatformCount = 0;
    base.scene.add(dynamicGroup);
    return dynamicGroup;
  }

  function addDynamicPlatform(platform) {
    if (!platform?.id || dynamicMeshes.has(platform.id)) return dynamicMeshes.get(platform?.id) || null;
    const group=ensureDynamicGroup();
    const mesh=createPlatformMesh(platform,worldHeight,pixelsPerUnit);
    dynamicMeshes.set(platform.id,mesh);
    group.add(mesh);
    group.userData.dynamicPlatformCount=dynamicMeshes.size;
    return mesh;
  }

  function clearDynamicPlatforms() {
    if (!dynamicGroup) return;
    for (const mesh of dynamicMeshes.values()) disposePlatformMesh(mesh);
    base.scene.remove(dynamicGroup);
    dynamicMeshes = new Map();
    dynamicGroup = null;
  }

  function mountLevel(level) {
    clearDynamicPlatforms();
    levelRef = level;
    worldHeight = Number(level?.worldHeight) || 540;
    const dynamicPlatforms = (level?.platforms || []).filter(isDynamicPlatform);
    const staticLevel = dynamicPlatforms.length
      ? { ...level, platforms:(level.platforms || []).filter((platform)=>!isDynamicPlatform(platform)) }
      : level;

    const descriptor = base.mountLevel(staticLevel);
    pixelsPerUnit = Number(descriptor?.pixelsPerUnit) || 80;
    for (const platform of dynamicPlatforms) addDynamicPlatform(platform);

    return Object.freeze({ ...descriptor, dynamicPlatformCount:dynamicMeshes.size, dynamicRuntime:DYNAMIC_PLATFORM_RUNTIME });
  }

  function sync(args = {}) {
    base.sync(args);
    if (!levelRef) return;
    for (const platform of levelRef.platforms || []) {
      if (!isDynamicPlatform(platform)) continue;
      const mesh = dynamicMeshes.get(platform.id) || addDynamicPlatform(platform);
      if (mesh) setPlatformPosition(mesh, platform, worldHeight, pixelsPerUnit);
    }
  }

  function getRenderStats() {
    return {
      ...base.getRenderStats(),
      dynamicRuntime:DYNAMIC_PLATFORM_RUNTIME,
      dynamicPlatformCount:dynamicMeshes.size
    };
  }

  function dispose() {
    clearDynamicPlatforms();
    base.dispose();
    levelRef = null;
  }

  return Object.freeze({
    version:base.version,
    optimization:base.optimization,
    dynamicRuntime:DYNAMIC_PLATFORM_RUNTIME,
    renderer:base.renderer,
    scene:base.scene,
    camera:base.camera,
    mountLevel,
    resize:base.resize,
    sync,
    render:base.render,
    getRenderStats,
    dispose,
    get descriptor() { return base.descriptor; }
  });
}

export { supportsSeedManWebGL };
