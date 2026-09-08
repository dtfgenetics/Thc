from pathlib import Path

path = Path('games/seed-man-platformer/src/render/three-world.mjs')
text = path.read_text()

import_anchor = "} from './three-world-state.mjs';\n"
import_line = "import { getVisualWorldPalette } from './visual-palette.mjs';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('three-world-state import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

dispose_old = "function disposeRuntimeObjects(object) {\n  object.traverse((child) => {\n"
dispose_new = "function disposeRuntimeObjects(object) {\n  for (const material of object?.userData?.ownedMaterials || []) material?.dispose?.();\n  object.traverse((child) => {\n"
if dispose_old not in text:
    raise SystemExit('disposeRuntimeObjects anchor missing')
text = text.replace(dispose_old, dispose_new, 1)

insert_anchor = "\nfunction buildCheckpoint(group, box, resources) {"
if 'seed-man-five-world-backdrop-v1' not in text:
    if insert_anchor not in text:
        raise SystemExit('backdrop insertion anchor missing')
    addition = r'''

const WORLD_BACKDROP_PROFILES = Object.freeze({
  'greenhouse-valley': Object.freeze({ kind: 'greenhouse', density: 1 }),
  'forest-ruins': Object.freeze({ kind: 'forest', density: 1.15 }),
  'desert-canyon': Object.freeze({ kind: 'desert', density: 0.78 }),
  'frozen-peak': Object.freeze({ kind: 'frozen', density: 0.92 }),
  'eco-city': Object.freeze({ kind: 'city', density: 1.05 })
});

function setMaterialColor(material, color) {
  material?.color?.setHex?.(color);
}

function applyVisualWorldStyle(scene, resources, lights, visualWorldKey) {
  const key = WORLD_BACKDROP_PROFILES[visualWorldKey] ? visualWorldKey : 'greenhouse-valley';
  const palette = getVisualWorldPalette(key);
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.fog, 11, 31);
  scene.userData.visualWorldKey = key;
  scene.userData.visualRuntime = 'seed-man-five-world-backdrop-v1';

  setMaterialColor(resources.materials.ground, palette.ground);
  setMaterialColor(resources.materials.platform, palette.ground);
  setMaterialColor(resources.materials.platformTop, palette.top);
  setMaterialColor(resources.materials.platformEdge, palette.near);
  setMaterialColor(resources.materials.hazard, palette.hazard);
  setMaterialColor(resources.materials.hazardWarning, palette.accent);
  setMaterialColor(resources.materials.benchMetal, palette.mid);

  lights.hemisphere.color.setHex(0xe8fff2);
  lights.hemisphere.groundColor.setHex(palette.ground);
  lights.fill.color.setHex(palette.fill);
  lights.rim.color.setHex(palette.accent);
  lights.playerGlow.color.setHex(palette.accent);
  return { key, palette, profile: WORLD_BACKDROP_PROFILES[key] };
}

function makeBackdropMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1
  });
}

function buildThemedBackdrop(scene, world, resources, visualWorldKey) {
  if (visualWorldKey === 'greenhouse-valley') return buildGreenhouseBackdrop(scene, world, resources);

  const palette = getVisualWorldPalette(visualWorldKey);
  const profile = WORLD_BACKDROP_PROFILES[visualWorldKey];
  const root = new THREE.Group();
  root.name = `seed-man-${visualWorldKey}-backdrop-v1`;
  root.userData.visualRuntime = 'seed-man-five-world-backdrop-v1';
  root.userData.visualWorldKey = visualWorldKey;

  const farMaterial = makeBackdropMaterial(palette.far, 0.72);
  const midMaterial = makeBackdropMaterial(palette.mid, 0.82);
  const nearMaterial = standardMaterial(palette.near, { roughness: 0.95 });
  const accentMaterial = standardMaterial(palette.accent, { roughness: 0.72, emissive: palette.accent, emissiveIntensity: 0.08 });
  const groundMaterial = standardMaterial(palette.ground, { roughness: 1 });
  root.userData.ownedMaterials = [farMaterial, midMaterial, nearMaterial, accentMaterial, groundMaterial];

  const farLayer = makeSharedMesh(resources.geometries.unitBox, farMaterial, world.width / 2, world.height * 0.48, -4.4);
  farLayer.scale.set(world.width + 9, world.height + 4, 0.04);
  const midLayer = makeSharedMesh(resources.geometries.unitBox, midMaterial, world.width / 2, world.height * 0.33, -3.85);
  midLayer.scale.set(world.width + 9, world.height * 0.72, 0.05);
  const horizon = makeSharedMesh(resources.geometries.unitBox, groundMaterial, world.width / 2, -0.3, -1.7);
  horizon.scale.set(world.width + 10, 0.58, 4.6);
  root.add(farLayer, midLayer, horizon);

  const silhouettes = [];
  const accents = [];
  const spacing = 3.8 / profile.density;
  for (let x = -1.5, i = 0; x <= world.width + 2; x += spacing, i += 1) {
    if (profile.kind === 'forest') {
      const trunkH = 2.8 + (i % 3) * 0.55;
      silhouettes.push({ position: [x, trunkH / 2, -3.15], scale: [0.34 + (i % 2) * 0.09, trunkH, 0.5] });
      silhouettes.push({ position: [x + 0.2, trunkH + 0.18, -3.12], scale: [1.65, 0.72 + (i % 2) * 0.2, 0.55] });
      if (i % 3 === 0) accents.push({ position: [x + 1.0, 0.7, -2.75], scale: [1.1, 0.18, 0.38], rotation: [0, 0, i % 2 ? 0.08 : -0.08] });
    } else if (profile.kind === 'desert') {
      const mesaH = 1.25 + (i % 4) * 0.38;
      silhouettes.push({ position: [x, mesaH / 2, -3.2], scale: [1.8 + (i % 2) * 0.7, mesaH, 0.8] });
      silhouettes.push({ position: [x + 0.25, mesaH + 0.24, -3.15], scale: [1.08, 0.48, 0.7] });
      if (i % 2 === 0) accents.push({ position: [x - 0.8, 0.65, -2.7], scale: [0.12, 1.3, 0.3] });
    } else if (profile.kind === 'frozen') {
      const ridgeH = 2.0 + (i % 4) * 0.5;
      silhouettes.push({ position: [x - 0.45, ridgeH / 2, -3.25], scale: [0.48, ridgeH, 0.65], rotation: [0, 0, 0.47] });
      silhouettes.push({ position: [x + 0.45, ridgeH / 2, -3.25], scale: [0.48, ridgeH, 0.65], rotation: [0, 0, -0.47] });
      if (i % 2 === 0) accents.push({ position: [x, 0.85, -2.7], scale: [0.16, 1.7, 0.32], rotation: [0, 0, 0.1] });
    } else if (profile.kind === 'city') {
      const towerH = 2.2 + (i % 5) * 0.42;
      silhouettes.push({ position: [x, towerH / 2, -3.2], scale: [0.8 + (i % 2) * 0.25, towerH, 0.72] });
      accents.push({ position: [x, towerH * 0.68, -2.78], scale: [0.52, 0.08, 0.16] });
      if (i % 2 === 0) accents.push({ position: [x + spacing * 0.48, 1.35, -2.95], scale: [spacing * 0.7, 0.1, 0.2] });
    }
  }

  addBatch(root, resources.geometries.unitBox, nearMaterial, silhouettes, `seed-man-${visualWorldKey}-silhouettes-v1`);
  addBatch(root, resources.geometries.unitBox, accentMaterial, accents, `seed-man-${visualWorldKey}-accents-v1`);
  scene.add(root);
  return root;
}
'''
    text = text.replace(insert_anchor, addition + insert_anchor, 1)

light_old = "  scene.add(new THREE.HemisphereLight(0xdff8e7, COLORS.ground, 2.25));\n  const sun = new THREE.DirectionalLight(COLORS.sun, 3.6);\n"
light_new = "  const hemisphere = new THREE.HemisphereLight(0xdff8e7, COLORS.ground, 2.25);\n  scene.add(hemisphere);\n  const sun = new THREE.DirectionalLight(COLORS.sun, 3.6);\n"
if light_old not in text:
    raise SystemExit('hemisphere light anchor missing')
text = text.replace(light_old, light_new, 1)

glow_anchor = "  scene.add(playerGlow);\n\n  let descriptor = null;\n"
glow_replace = "  scene.add(playerGlow);\n  const worldLights = Object.freeze({ hemisphere, sun, fill, rim, playerGlow });\n\n  let descriptor = null;\n"
if glow_anchor not in text:
    raise SystemExit('world lights anchor missing')
text = text.replace(glow_anchor, glow_replace, 1)

mount_old = "    clearLevel();\n    backdropRoot = buildGreenhouseBackdrop(scene, descriptor.world, resources);\n    levelRoot = buildLevelMeshes(scene, descriptor, resources);\n"
mount_new = "    clearLevel();\n    const visualStyle = applyVisualWorldStyle(scene, resources, worldLights, descriptor.visualWorldKey);\n    backdropRoot = buildThemedBackdrop(scene, descriptor.world, resources, visualStyle.key);\n    levelRoot = buildLevelMeshes(scene, descriptor, resources);\n    levelRoot.userData.visualWorldKey = visualStyle.key;\n"
if mount_old not in text:
    raise SystemExit('mountLevel backdrop anchor missing')
text = text.replace(mount_old, mount_new, 1)

stats_old = "      optimization: levelRoot?.userData?.renderOptimization || null\n"
stats_new = "      optimization: levelRoot?.userData?.renderOptimization || null,\n      visualWorldKey: descriptor?.visualWorldKey || null,\n      visualRuntime: scene.userData.visualRuntime || null\n"
if stats_old not in text:
    raise SystemExit('render stats anchor missing')
text = text.replace(stats_old, stats_new, 1)

path.write_text(text)
