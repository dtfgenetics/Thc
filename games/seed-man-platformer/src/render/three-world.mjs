import * as THREE from 'three';
import {
  buildPlayerLightState,
  buildThreeCameraState,
  buildThreeWorldDescriptor,
  THREE_WORLD_DEFAULTS
} from './three-world-state.mjs';
import { getVisualWorldPalette } from './visual-palette.mjs';

const COLORS = Object.freeze({
  sky: 0x8bcfb6,
  fog: 0xb9dec8,
  greenhouseFrame: 0x335f50,
  greenhouseGlass: 0xcdf4df,
  distantGlass: 0x9bcfbb,
  soil: 0x4b3226,
  soilTop: 0x76533a,
  ground: 0x24412f,
  platform: 0x426b45,
  platformTop: 0x9ad369,
  platformEdge: 0x203a29,
  benchMetal: 0x668b78,
  hazard: 0xc85835,
  hazardGlow: 0x6f2318,
  checkpoint: 0xf1c85f,
  checkpointGlow: 0x7a5911,
  finish: 0xbef36f,
  finishDark: 0x315b2f,
  fill: 0x9ec5ff,
  sun: 0xffefc5,
  playerGlow: 0xb8ff7c,
  canopyDark: 0x173b2b,
  canopyMid: 0x2e6a43,
  canopyLight: 0x6f9e58,
  pot: 0x9d5f43,
  potRim: 0xc77f5c
});

function supportsWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      typeof window !== 'undefined' &&
      window.WebGLRenderingContext &&
      (probe.getContext('webgl2') || probe.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function standardMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function createRenderResources() {
  const geometries = {
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    plantPot: new THREE.CylinderGeometry(0.18, 0.14, 0.32, 8),
    plantRim: new THREE.CylinderGeometry(0.205, 0.205, 0.07, 8),
    plantStem: new THREE.CylinderGeometry(0.025, 0.035, 0.52, 6),
    plantLeaf: new THREE.SphereGeometry(0.18, 7, 5),
    checkpointPole: new THREE.CylinderGeometry(0.035, 0.045, 1, 8),
    checkpointLamp: new THREE.SphereGeometry(0.13, 10, 8),
    finishPole: new THREE.CylinderGeometry(0.035, 0.045, 1, 8),
    finishFlag: new THREE.PlaneGeometry(0.72, 0.38)
  };

  const materials = {
    frame: standardMaterial(COLORS.greenhouseFrame, { roughness: 0.5, metalness: 0.2 }),
    ground: standardMaterial(COLORS.ground, { roughness: 1 }),
    soil: standardMaterial(COLORS.soil, { roughness: 1 }),
    soilTop: standardMaterial(COLORS.soilTop, { roughness: 1 }),
    platform: standardMaterial(COLORS.platform, { roughness: 0.86 }),
    platformTop: standardMaterial(COLORS.platformTop, { roughness: 0.7 }),
    platformEdge: standardMaterial(COLORS.platformEdge, { roughness: 0.88 }),
    benchMetal: standardMaterial(COLORS.benchMetal, { roughness: 0.56, metalness: 0.18 }),
    hazard: standardMaterial(COLORS.hazard, {
      roughness: 0.66,
      emissive: COLORS.hazardGlow,
      emissiveIntensity: 0.7
    }),
    hazardWarning: standardMaterial(0xff8d4a, {
      roughness: 0.55,
      emissive: 0x7b2a13,
      emissiveIntensity: 0.8
    }),
    pot: standardMaterial(COLORS.pot, { roughness: 0.9 }),
    potRim: standardMaterial(COLORS.potRim, { roughness: 0.82 }),
    stem: standardMaterial(COLORS.canopyMid, { roughness: 0.96 }),
    leafDark: standardMaterial(COLORS.canopyDark, { roughness: 0.92 }),
    leafLight: standardMaterial(COLORS.canopyLight, { roughness: 0.9 }),
    checkpointPole: standardMaterial(0x815e2e, { roughness: 0.8 }),
    checkpointGlow: standardMaterial(COLORS.checkpoint, {
      roughness: 0.46,
      emissive: COLORS.checkpointGlow,
      emissiveIntensity: 0.65
    }),
    finishPole: standardMaterial(COLORS.finishDark, { roughness: 0.7 }),
    finishFlag: new THREE.MeshStandardMaterial({
      color: COLORS.finish,
      side: THREE.DoubleSide,
      emissive: 0x355d19,
      emissiveIntensity: 0.35,
      roughness: 0.7
    })
  };

  return { geometries, materials };
}

function disposeRenderResources(resources) {
  const geometries = new Set(Object.values(resources.geometries));
  const materials = new Set(Object.values(resources.materials));
  for (const geometry of geometries) geometry?.dispose?.();
  for (const material of materials) material?.dispose?.();
}

function disposeRuntimeObjects(object) {
  for (const material of object?.userData?.ownedMaterials || []) material?.dispose?.();
  object.traverse((child) => {
    if (child.isInstancedMesh) child.dispose?.();
    if (child.userData?.ownedGeometry) child.geometry?.dispose?.();
    if (child.userData?.ownedMaterial) {
      if (Array.isArray(child.material)) {
        for (const material of child.material) material?.dispose?.();
      } else {
        child.material?.dispose?.();
      }
    }
  });
}

function makeOwnedMesh(geometry, material, x, y, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.userData.ownedGeometry = true;
  mesh.userData.ownedMaterial = true;
  return mesh;
}

function makeSharedMesh(geometry, material, x, y, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function createInstancedBatch(geometry, material, transforms, name) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.frustumCulled = true;
  const dummy = new THREE.Object3D();

  transforms.forEach((transform, index) => {
    const position = transform.position || [0, 0, 0];
    const scale = transform.scale || [1, 1, 1];
    const rotation = transform.rotation || [0, 0, 0];
    dummy.position.set(position[0], position[1], position[2]);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function addBatch(group, geometry, material, transforms, name) {
  const mesh = createInstancedBatch(geometry, material, transforms, name);
  if (mesh) group.add(mesh);
  return mesh;
}

function boxTransform(box, { x = 0, y = 0, z = 0, scaleX = 1, scaleY = 1, scaleZ = 1, rotationZ = 0 } = {}) {
  return {
    position: [box.position.x + x, box.position.y + y, box.position.z + z],
    scale: [box.size.x * scaleX, box.size.y * scaleY, box.size.z * scaleZ],
    rotation: [0, 0, rotationZ]
  };
}

function buildPlantBatches(root, resources, plants) {
  if (!plants.length) return;
  const potTransforms = [];
  const rimTransforms = [];
  const stemTransforms = [];
  const darkLeafTransforms = [];
  const lightLeafTransforms = [];
  const leafPositions = [
    [-0.15, 0.77, 0.02], [0.14, 0.82, 0.01], [-0.03, 0.96, 0],
    [-0.21, 0.94, -0.02], [0.2, 1.02, 0.01], [0.02, 1.14, -0.01]
  ];

  for (const plant of plants) {
    const { x, y, z, scale } = plant;
    potTransforms.push({ position: [x, y + 0.16 * scale, z], scale: [scale, scale, scale] });
    rimTransforms.push({ position: [x, y + 0.33 * scale, z], scale: [scale, scale, scale] });
    stemTransforms.push({ position: [x, y + 0.63 * scale, z], scale: [scale, scale, scale] });

    leafPositions.forEach(([dx, dy, dz], index) => {
      const transform = {
        position: [x + dx * scale, y + dy * scale, z + dz],
        scale: [1.25 * scale, 0.6 * scale, 0.42 * scale],
        rotation: [0, 0, (index % 2 ? 1 : -1) * 0.36]
      };
      (index % 2 ? lightLeafTransforms : darkLeafTransforms).push(transform);
    });
  }

  addBatch(root, resources.geometries.plantPot, resources.materials.pot, potTransforms, 'seed-man-plant-pots-v1');
  addBatch(root, resources.geometries.plantRim, resources.materials.potRim, rimTransforms, 'seed-man-plant-rims-v1');
  addBatch(root, resources.geometries.plantStem, resources.materials.stem, stemTransforms, 'seed-man-plant-stems-v1');
  addBatch(root, resources.geometries.plantLeaf, resources.materials.leafDark, darkLeafTransforms, 'seed-man-plant-leaves-dark-v1');
  addBatch(root, resources.geometries.plantLeaf, resources.materials.leafLight, lightLeafTransforms, 'seed-man-plant-leaves-light-v1');
}

function buildGreenhouseBackdrop(scene, world, resources) {
  const root = new THREE.Group();
  root.name = 'seed-man-greenhouse-backdrop-v2';

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: COLORS.greenhouseGlass,
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const distantGlassMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.distantGlass,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  });

  const backWall = makeOwnedMesh(new THREE.PlaneGeometry(world.width + 8, world.height + 5), glassMaterial, world.width / 2, world.height / 2 + 1.05, -3.6);
  root.add(backWall);

  const hazeWall = makeOwnedMesh(new THREE.PlaneGeometry(world.width + 8, world.height + 5), distantGlassMaterial, world.width / 2, world.height / 2 + 0.65, -4.1);
  root.add(hazeWall);

  const ribTransforms = [];
  const roofBraceTransforms = [];
  const ribSpacing = 3.1;
  for (let x = -1; x <= world.width + 1; x += ribSpacing) {
    ribTransforms.push({
      position: [x, world.height / 2 + 1.0, -3.22],
      scale: [0.055, world.height + 4.4, 0.08]
    });
    roofBraceTransforms.push({
      position: [x + 0.55, world.height + 0.92, -3.15],
      scale: [2.5, 0.045, 0.07],
      rotation: [0, 0, -0.24]
    });
  }
  addBatch(root, resources.geometries.unitBox, resources.materials.frame, ribTransforms, 'seed-man-greenhouse-ribs-v1');
  addBatch(root, resources.geometries.unitBox, resources.materials.frame, roofBraceTransforms, 'seed-man-greenhouse-braces-v1');

  const roofRail = makeSharedMesh(resources.geometries.unitBox, resources.materials.frame, world.width / 2, world.height + 0.62, -3.1);
  roofRail.scale.set(world.width + 5, 0.08, 0.1);
  root.add(roofRail);

  const horizon = makeSharedMesh(resources.geometries.unitBox, resources.materials.ground, world.width / 2, -0.32, -1.4);
  horizon.scale.set(world.width + 10, 0.55, 5);
  root.add(horizon);

  const aisle = makeSharedMesh(resources.geometries.unitBox, resources.materials.soil, world.width / 2, 0.02, -2.25);
  aisle.scale.set(world.width + 9, 0.08, 2.1);
  root.add(aisle);

  const plants = [];
  for (let x = 1.1; x < world.width; x += 6.4) {
    plants.push({
      x,
      y: 0.02,
      z: -2.1,
      scale: 0.84 + ((Math.floor(x * 10) % 3) * 0.08)
    });
  }
  buildPlantBatches(root, resources, plants);

  scene.add(root);
  return root;
}


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

function buildCheckpoint(group, box, resources) {
  const baseY = box.position.y - box.size.y / 2;
  const poleHeight = Math.max(0.6, box.size.y);
  const pole = makeSharedMesh(resources.geometries.checkpointPole, resources.materials.checkpointPole, box.position.x, baseY + poleHeight / 2, box.position.z);
  pole.scale.y = poleHeight;
  const lamp = makeSharedMesh(resources.geometries.checkpointLamp, resources.materials.checkpointGlow, box.position.x, box.position.y + box.size.y / 2 + 0.08, box.position.z + 0.03);
  group.add(pole, lamp);
}

function buildFinish(group, box, resources) {
  const poleHeight = Math.max(1.25, box.size.y + 0.5);
  const pole = makeSharedMesh(resources.geometries.finishPole, resources.materials.finishPole, box.position.x - box.size.x * 0.18, box.position.y + 0.2, box.position.z);
  pole.scale.y = poleHeight;
  const flag = makeSharedMesh(resources.geometries.finishFlag, resources.materials.finishFlag, box.position.x + 0.3, box.position.y + poleHeight * 0.34, box.position.z + 0.04);
  group.add(pole, flag);
}

function buildLevelMeshes(scene, descriptor, resources) {
  const root = new THREE.Group();
  root.name = 'seed-man-level-world-v2';

  const platforms = [];
  const caps = [];
  const edges = [];
  const legs = [];
  const soilInsets = [];
  const hazards = [];
  const warnings = [];

  for (const platform of descriptor.platforms) {
    platforms.push(boxTransform(platform));

    const capHeight = Math.min(0.12, Math.max(0.055, platform.size.y * 0.28));
    caps.push({
      position: [
        platform.position.x,
        platform.position.y + platform.size.y / 2 - capHeight / 2 + 0.012,
        platform.position.z + 0.025
      ],
      scale: [platform.size.x + 0.03, capHeight, platform.size.z + 0.04]
    });

    edges.push({
      position: [
        platform.position.x,
        platform.position.y - platform.size.y / 2 + 0.035,
        platform.position.z + 0.035
      ],
      scale: [platform.size.x + 0.04, 0.045, platform.size.z + 0.07]
    });

    if (platform.size.y <= 0.62 && platform.size.x >= 1.35) {
      const legHeight = Math.max(0.32, platform.position.y - platform.size.y / 2 + 0.08);
      if (legHeight > 0.24) {
        const offsets = platform.size.x > 2.6 ? [-0.38, 0, 0.38] : [-0.38, 0.38];
        for (const ratio of offsets) {
          legs.push({
            position: [platform.position.x + platform.size.x * ratio, legHeight / 2, platform.position.z - 0.12],
            scale: [0.07, legHeight, 0.16]
          });
        }
      }
    }

    if (platform.size.x >= 1.8 && platform.size.y <= 0.95) {
      soilInsets.push({
        position: [
          platform.position.x,
          platform.position.y + platform.size.y / 2 + 0.075,
          platform.position.z + 0.01
        ],
        scale: [Math.max(0.4, platform.size.x - 0.24), 0.08, Math.max(0.3, platform.size.z - 0.04)]
      });
    }
  }

  for (const hazard of descriptor.hazards) {
    hazards.push(boxTransform(hazard, { rotationZ: 0.015 }));
    warnings.push({
      position: [hazard.position.x, hazard.position.y + hazard.size.y / 2 + 0.025, hazard.position.z + 0.03],
      scale: [Math.max(0.1, hazard.size.x - 0.08), 0.045, hazard.size.z + 0.05]
    });
  }

  const boxGeometry = resources.geometries.unitBox;
  addBatch(root, boxGeometry, resources.materials.platform, platforms, 'seed-man-platforms-v1');
  addBatch(root, boxGeometry, resources.materials.platformTop, caps, 'seed-man-platform-caps-v1');
  addBatch(root, boxGeometry, resources.materials.platformEdge, edges, 'seed-man-platform-edges-v1');
  addBatch(root, boxGeometry, resources.materials.benchMetal, legs, 'seed-man-platform-legs-v1');
  addBatch(root, boxGeometry, resources.materials.soilTop, soilInsets, 'seed-man-platform-soil-v1');
  addBatch(root, boxGeometry, resources.materials.hazard, hazards, 'seed-man-hazards-v1');
  addBatch(root, boxGeometry, resources.materials.hazardWarning, warnings, 'seed-man-hazard-warnings-v1');

  for (const checkpoint of descriptor.checkpoints) buildCheckpoint(root, checkpoint, resources);
  if (descriptor.finish) buildFinish(root, descriptor.finish, resources);

  root.userData.renderOptimization = 'seed-man-three-instancing-v1';
  root.userData.staticBatchCount = root.children.filter((child) => child.isInstancedMesh).length;
  scene.add(root);
  return root;
}

function configureRenderer(renderer, pixelRatio) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(pixelRatio);
}

export function createThreeWorldRenderer({
  canvas,
  pixelsPerUnit = THREE_WORLD_DEFAULTS.pixelsPerUnit,
  pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
} = {}) {
  if (!canvas) throw new Error('Seed Man Three.js renderer requires a canvas');
  if (!supportsWebGL()) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  configureRenderer(renderer, pixelRatio);

  const resources = createRenderResources();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 11, 31);

  const camera = new THREE.OrthographicCamera(-6, 6, 3.375, -3.375, 0.1, 60);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  const hemisphere = new THREE.HemisphereLight(0xdff8e7, COLORS.ground, 2.25);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(COLORS.sun, 3.6);
  sun.position.set(4.5, 9.5, 8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(COLORS.fill, 1.05);
  fill.position.set(-6, 3.5, 7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc8f36a, 0.55);
  rim.position.set(0, 7, -2);
  scene.add(rim);

  const playerGlow = new THREE.PointLight(COLORS.playerGlow, 8.1, 8.2, 2);
  playerGlow.position.set(0, 2, 2.2);
  scene.add(playerGlow);
  const worldLights = Object.freeze({ hemisphere, sun, fill, rim, playerGlow });

  let descriptor = null;
  let levelRoot = null;
  let backdropRoot = null;
  let levelWorldHeight = THREE_WORLD_DEFAULTS.viewport.height;
  let cssWidth = THREE_WORLD_DEFAULTS.viewport.width;
  let cssHeight = THREE_WORLD_DEFAULTS.viewport.height;
  let disposed = false;

  function clearLevel() {
    if (levelRoot) {
      scene.remove(levelRoot);
      disposeRuntimeObjects(levelRoot);
      levelRoot = null;
    }
    if (backdropRoot) {
      scene.remove(backdropRoot);
      disposeRuntimeObjects(backdropRoot);
      backdropRoot = null;
    }
  }

  function mountLevel(level) {
    if (disposed) throw new Error('Seed Man Three.js renderer is disposed');
    descriptor = buildThreeWorldDescriptor(level, { pixelsPerUnit });
    levelWorldHeight = descriptor.world.heightPixels;
    clearLevel();
    const visualStyle = applyVisualWorldStyle(scene, resources, worldLights, descriptor.visualWorldKey);
    backdropRoot = buildThemedBackdrop(scene, descriptor.world, resources, visualStyle.key);
    levelRoot = buildLevelMeshes(scene, descriptor, resources);
    levelRoot.userData.visualWorldKey = visualStyle.key;
    return descriptor;
  }

  function resize(width = canvas.clientWidth, height = canvas.clientHeight) {
    if (disposed) return;
    cssWidth = Math.max(1, Number(width) || THREE_WORLD_DEFAULTS.viewport.width);
    cssHeight = Math.max(1, Number(height) || THREE_WORLD_DEFAULTS.viewport.height);
    renderer.setSize(cssWidth, cssHeight, false);
  }

  function sync({ cameraX = 0, player = null, elapsed = 0 } = {}) {
    if (disposed || !descriptor) return;
    const cameraState = buildThreeCameraState({
      cameraX,
      viewportWidth: cssWidth,
      viewportHeight: cssHeight,
      worldHeight: levelWorldHeight,
      pixelsPerUnit
    });

    const visibleHeight = descriptor.world.height;
    const visibleWidth = visibleHeight * cameraState.aspect;
    camera.left = -visibleWidth / 2;
    camera.right = visibleWidth / 2;
    camera.top = visibleHeight / 2;
    camera.bottom = -visibleHeight / 2;
    camera.position.x = cameraState.center.x;
    camera.position.y = cameraState.center.y;
    camera.updateProjectionMatrix();

    const lightState = buildPlayerLightState(player, levelWorldHeight, { pixelsPerUnit, z: 2.2 });
    if (lightState) {
      playerGlow.position.set(lightState.x, lightState.y, lightState.z);
      playerGlow.intensity = 7.2 + Math.sin(Number(elapsed || 0) * 4.2) * 0.75;
    }
  }

  function render() {
    if (disposed || !descriptor) return;
    renderer.render(scene, camera);
  }

  function getRenderStats() {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      staticBatchCount: levelRoot?.userData?.staticBatchCount || 0,
      optimization: levelRoot?.userData?.renderOptimization || null,
      visualWorldKey: descriptor?.visualWorldKey || null,
      visualRuntime: scene.userData.visualRuntime || null
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearLevel();
    disposeRenderResources(resources);
    renderer.dispose();
  }

  resize();

  return {
    version: 'seed-man-three-world-v2',
    optimization: 'seed-man-three-instancing-v1',
    renderer,
    scene,
    camera,
    mountLevel,
    resize,
    sync,
    render,
    getRenderStats,
    dispose,
    get descriptor() {
      return descriptor;
    }
  };
}

export { supportsWebGL as supportsSeedManWebGL };
