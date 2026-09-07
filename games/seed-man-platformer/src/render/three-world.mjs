import * as THREE from 'three';
import {
  buildPlayerLightState,
  buildThreeCameraState,
  buildThreeWorldDescriptor,
  THREE_WORLD_DEFAULTS
} from './three-world-state.mjs';

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

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry?.dispose) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      for (const material of child.material) material?.dispose?.();
    } else {
      child.material?.dispose?.();
    }
  });
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

function makeBox(box, material) {
  const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(box.position.x, box.position.y, box.position.z);
  mesh.userData.sourceId = box.id;
  return mesh;
}

function makeMesh(geometry, material, x, y, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function addPlatformCap(group, box) {
  const capHeight = Math.min(0.12, Math.max(0.055, box.size.y * 0.28));
  const geometry = new THREE.BoxGeometry(box.size.x + 0.03, capHeight, box.size.z + 0.04);
  const material = standardMaterial(COLORS.platformTop, { roughness: 0.7 });
  const cap = new THREE.Mesh(geometry, material);
  cap.position.set(
    box.position.x,
    box.position.y + box.size.y / 2 - capHeight / 2 + 0.012,
    box.position.z + 0.025
  );
  cap.userData.sourceId = `${box.id}:cap`;
  group.add(cap);
}

function addPlatformEdge(group, box) {
  const geometry = new THREE.BoxGeometry(box.size.x + 0.04, 0.045, box.size.z + 0.07);
  const edge = new THREE.Mesh(geometry, standardMaterial(COLORS.platformEdge, { roughness: 0.88 }));
  edge.position.set(
    box.position.x,
    box.position.y - box.size.y / 2 + 0.035,
    box.position.z + 0.035
  );
  group.add(edge);
}

function addBenchLegs(group, box) {
  if (box.size.y > 0.62 || box.size.x < 1.35) return;
  const legMaterial = standardMaterial(COLORS.benchMetal, { roughness: 0.56, metalness: 0.18 });
  const legHeight = Math.max(0.32, box.position.y - box.size.y / 2 + 0.08);
  if (legHeight <= 0.24) return;
  const offsets = box.size.x > 2.6 ? [-0.38, 0, 0.38] : [-0.38, 0.38];
  for (const ratio of offsets) {
    const x = box.position.x + box.size.x * ratio;
    const leg = makeMesh(new THREE.BoxGeometry(0.07, legHeight, 0.16), legMaterial.clone(), x, legHeight / 2, box.position.z - 0.12);
    group.add(leg);
  }
}

function addSoilInset(group, box) {
  if (box.size.x < 1.8 || box.size.y > 0.95) return;
  const soilWidth = Math.max(0.4, box.size.x - 0.24);
  const soil = makeMesh(
    new THREE.BoxGeometry(soilWidth, 0.08, Math.max(0.3, box.size.z - 0.04)),
    standardMaterial(COLORS.soilTop, { roughness: 1 }),
    box.position.x,
    box.position.y + box.size.y / 2 + 0.075,
    box.position.z + 0.01
  );
  group.add(soil);
}

function addPottedPlant(group, x, y, z, scale = 1) {
  const potMaterial = standardMaterial(COLORS.pot, { roughness: 0.9 });
  const rimMaterial = standardMaterial(COLORS.potRim, { roughness: 0.82 });
  const stemMaterial = standardMaterial(COLORS.canopyMid, { roughness: 0.96 });
  const leafDark = standardMaterial(COLORS.canopyDark, { roughness: 0.92 });
  const leafLight = standardMaterial(COLORS.canopyLight, { roughness: 0.9 });

  const pot = makeMesh(new THREE.CylinderGeometry(0.18 * scale, 0.14 * scale, 0.32 * scale, 8), potMaterial, x, y + 0.16 * scale, z);
  const rim = makeMesh(new THREE.CylinderGeometry(0.205 * scale, 0.205 * scale, 0.07 * scale, 8), rimMaterial, x, y + 0.33 * scale, z);
  const stem = makeMesh(new THREE.CylinderGeometry(0.025 * scale, 0.035 * scale, 0.52 * scale, 6), stemMaterial, x, y + 0.63 * scale, z);
  group.add(pot, rim, stem);

  const leafGeometry = new THREE.SphereGeometry(0.18 * scale, 7, 5);
  const leafPositions = [
    [-0.15, 0.77, 0.02], [0.14, 0.82, 0.01], [-0.03, 0.96, 0],
    [-0.21, 0.94, -0.02], [0.2, 1.02, 0.01], [0.02, 1.14, -0.01]
  ];
  leafPositions.forEach(([dx, dy, dz], index) => {
    const leaf = makeMesh(leafGeometry.clone(), (index % 2 ? leafLight : leafDark).clone(), x + dx * scale, y + dy * scale, z + dz);
    leaf.scale.set(1.25, 0.6, 0.42);
    leaf.rotation.z = (index % 2 ? 1 : -1) * 0.36;
    group.add(leaf);
  });
}

function buildGreenhouseBackdrop(scene, world) {
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
  const frameMaterial = standardMaterial(COLORS.greenhouseFrame, { roughness: 0.5, metalness: 0.2 });

  const backWall = makeMesh(new THREE.PlaneGeometry(world.width + 8, world.height + 5), glassMaterial, world.width / 2, world.height / 2 + 1.05, -3.6);
  root.add(backWall);

  const hazeWall = makeMesh(new THREE.PlaneGeometry(world.width + 8, world.height + 5), distantGlassMaterial, world.width / 2, world.height / 2 + 0.65, -4.1);
  root.add(hazeWall);

  const ribSpacing = 3.1;
  for (let x = -1; x <= world.width + 1; x += ribSpacing) {
    const rib = makeMesh(new THREE.BoxGeometry(0.055, world.height + 4.4, 0.08), frameMaterial.clone(), x, world.height / 2 + 1.0, -3.22);
    root.add(rib);
    const roofBrace = makeMesh(new THREE.BoxGeometry(2.5, 0.045, 0.07), frameMaterial.clone(), x + 0.55, world.height + 0.92, -3.15);
    roofBrace.rotation.z = -0.24;
    root.add(roofBrace);
  }

  const roofRail = makeMesh(new THREE.BoxGeometry(world.width + 5, 0.08, 0.1), frameMaterial.clone(), world.width / 2, world.height + 0.62, -3.1);
  root.add(roofRail);

  const horizon = makeMesh(
    new THREE.BoxGeometry(world.width + 10, 0.55, 5),
    standardMaterial(COLORS.ground, { roughness: 1 }),
    world.width / 2,
    -0.32,
    -1.4
  );
  root.add(horizon);

  const aisle = makeMesh(
    new THREE.BoxGeometry(world.width + 9, 0.08, 2.1),
    standardMaterial(COLORS.soil, { roughness: 1 }),
    world.width / 2,
    0.02,
    -2.25
  );
  root.add(aisle);

  for (let x = 1.1; x < world.width; x += 6.4) {
    addPottedPlant(root, x, 0.02, -2.1, 0.84 + ((Math.floor(x * 10) % 3) * 0.08));
  }

  scene.add(root);
  return root;
}

function buildCheckpoint(group, box) {
  const poleMaterial = standardMaterial(0x815e2e, { roughness: 0.8 });
  const glowMaterial = standardMaterial(COLORS.checkpoint, {
    roughness: 0.46,
    emissive: COLORS.checkpointGlow,
    emissiveIntensity: 0.65
  });
  const baseY = box.position.y - box.size.y / 2;
  const pole = makeMesh(new THREE.CylinderGeometry(0.035, 0.045, Math.max(0.6, box.size.y), 8), poleMaterial, box.position.x, baseY + Math.max(0.6, box.size.y) / 2, box.position.z);
  const lamp = makeMesh(new THREE.SphereGeometry(0.13, 10, 8), glowMaterial, box.position.x, box.position.y + box.size.y / 2 + 0.08, box.position.z + 0.03);
  group.add(pole, lamp);
}

function buildFinish(group, box) {
  const poleHeight = Math.max(1.25, box.size.y + 0.5);
  const pole = makeMesh(new THREE.CylinderGeometry(0.035, 0.045, poleHeight, 8), standardMaterial(COLORS.finishDark, { roughness: 0.7 }), box.position.x - box.size.x * 0.18, box.position.y + 0.2, box.position.z);
  const flag = makeMesh(new THREE.PlaneGeometry(0.72, 0.38), new THREE.MeshStandardMaterial({ color: COLORS.finish, side: THREE.DoubleSide, emissive: 0x355d19, emissiveIntensity: 0.35, roughness: 0.7 }), box.position.x + 0.3, box.position.y + poleHeight * 0.34, box.position.z + 0.04);
  group.add(pole, flag);
}

function buildLevelMeshes(scene, descriptor) {
  const root = new THREE.Group();
  root.name = 'seed-man-level-world-v2';

  const platformMaterial = standardMaterial(COLORS.platform, { roughness: 0.86 });
  const hazardMaterial = standardMaterial(COLORS.hazard, {
    roughness: 0.66,
    emissive: COLORS.hazardGlow,
    emissiveIntensity: 0.7
  });

  for (const platform of descriptor.platforms) {
    root.add(makeBox(platform, platformMaterial.clone()));
    addPlatformCap(root, platform);
    addPlatformEdge(root, platform);
    addBenchLegs(root, platform);
    addSoilInset(root, platform);
  }

  for (const hazard of descriptor.hazards) {
    const mesh = makeBox(hazard, hazardMaterial.clone());
    mesh.rotation.z = 0.015;
    root.add(mesh);
    const warning = makeMesh(
      new THREE.BoxGeometry(Math.max(0.1, hazard.size.x - 0.08), 0.045, hazard.size.z + 0.05),
      standardMaterial(0xff8d4a, { roughness: 0.55, emissive: 0x7b2a13, emissiveIntensity: 0.8 }),
      hazard.position.x,
      hazard.position.y + hazard.size.y / 2 + 0.025,
      hazard.position.z + 0.03
    );
    root.add(warning);
  }

  for (const checkpoint of descriptor.checkpoints) buildCheckpoint(root, checkpoint);
  if (descriptor.finish) buildFinish(root, descriptor.finish);

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 11, 31);

  const camera = new THREE.OrthographicCamera(-6, 6, 3.375, -3.375, 0.1, 60);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xdff8e7, COLORS.ground, 2.25));
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
      disposeObject(levelRoot);
      levelRoot = null;
    }
    if (backdropRoot) {
      scene.remove(backdropRoot);
      disposeObject(backdropRoot);
      backdropRoot = null;
    }
  }

  function mountLevel(level) {
    if (disposed) throw new Error('Seed Man Three.js renderer is disposed');
    descriptor = buildThreeWorldDescriptor(level, { pixelsPerUnit });
    levelWorldHeight = descriptor.world.heightPixels;
    clearLevel();
    backdropRoot = buildGreenhouseBackdrop(scene, descriptor.world);
    levelRoot = buildLevelMeshes(scene, descriptor);
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

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearLevel();
    renderer.dispose();
  }

  resize();

  return {
    version: 'seed-man-three-world-v2',
    renderer,
    scene,
    camera,
    mountLevel,
    resize,
    sync,
    render,
    dispose,
    get descriptor() {
      return descriptor;
    }
  };
}

export { supportsWebGL as supportsSeedManWebGL };