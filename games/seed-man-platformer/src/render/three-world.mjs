import * as THREE from 'three';
import {
  buildPlayerLightState,
  buildThreeCameraState,
  buildThreeWorldDescriptor,
  THREE_WORLD_DEFAULTS
} from './three-world-state.mjs';

const COLORS = Object.freeze({
  sky: 0xcde9dc,
  fog: 0xd7ebd4,
  greenhouseFrame: 0xb9d8ca,
  greenhouseGlass: 0xdff6ee,
  ground: 0x35543a,
  platform: 0x527849,
  platformTop: 0x91c66a,
  hazard: 0x9c4f2f,
  checkpoint: 0xe2bf5f,
  finish: 0xb9ef72,
  fill: 0x8ab8ff,
  sun: 0xfff2c7,
  playerGlow: 0x9cf076
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

function makeBox(box, material) {
  const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(box.position.x, box.position.y, box.position.z);
  mesh.userData.sourceId = box.id;
  return mesh;
}

function addPlatformCap(group, box) {
  const geometry = new THREE.BoxGeometry(box.size.x, Math.min(0.09, box.size.y * 0.35), box.size.z + 0.025);
  const material = new THREE.MeshStandardMaterial({
    color: COLORS.platformTop,
    roughness: 0.72,
    metalness: 0
  });
  const cap = new THREE.Mesh(geometry, material);
  cap.position.set(
    box.position.x,
    box.position.y + box.size.y / 2 - geometry.parameters.height / 2,
    box.position.z + 0.01
  );
  cap.userData.sourceId = `${box.id}:cap`;
  group.add(cap);
}

function buildGreenhouseBackdrop(scene, world) {
  const root = new THREE.Group();
  root.name = 'seed-man-greenhouse-backdrop';

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: COLORS.greenhouseGlass,
    transparent: true,
    opacity: 0.15,
    roughness: 0.22,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.greenhouseFrame,
    roughness: 0.48,
    metalness: 0.18
  });

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width + 8, world.height + 5),
    glassMaterial
  );
  glass.position.set(world.width / 2, world.height / 2 + 1.2, -3.4);
  root.add(glass);

  const ribSpacing = 3.25;
  for (let x = -1; x <= world.width + 1; x += ribSpacing) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, world.height + 4.5, 0.06),
      frameMaterial.clone()
    );
    rib.position.set(x, world.height / 2 + 1, -3.15);
    root.add(rib);
  }

  const horizonMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.ground,
    roughness: 1,
    metalness: 0
  });
  const horizon = new THREE.Mesh(
    new THREE.BoxGeometry(world.width + 10, 0.45, 4.5),
    horizonMaterial
  );
  horizon.position.set(world.width / 2, -0.28, -1.3);
  root.add(horizon);

  scene.add(root);
  return root;
}

function buildLevelMeshes(scene, descriptor) {
  const root = new THREE.Group();
  root.name = 'seed-man-level-world';

  const platformMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.platform,
    roughness: 0.86,
    metalness: 0
  });
  const hazardMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.hazard,
    emissive: 0x5c2014,
    emissiveIntensity: 0.48,
    roughness: 0.68
  });
  const checkpointMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.checkpoint,
    emissive: 0x49370a,
    emissiveIntensity: 0.28,
    roughness: 0.62
  });
  const finishMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.finish,
    emissive: 0x31581b,
    emissiveIntensity: 0.55,
    roughness: 0.5
  });

  for (const platform of descriptor.platforms) {
    root.add(makeBox(platform, platformMaterial.clone()));
    addPlatformCap(root, platform);
  }
  for (const hazard of descriptor.hazards) root.add(makeBox(hazard, hazardMaterial.clone()));
  for (const checkpoint of descriptor.checkpoints) root.add(makeBox(checkpoint, checkpointMaterial.clone()));
  if (descriptor.finish) root.add(makeBox(descriptor.finish, finishMaterial));

  scene.add(root);
  return root;
}

function configureRenderer(renderer, pixelRatio) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(pixelRatio);
}

export function createThreeWorldRenderer({
  canvas,
  pixelsPerUnit = THREE_WORLD_DEFAULTS.pixelsPerUnit,
  pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.6)
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
  scene.fog = new THREE.Fog(COLORS.fog, 8, 25);

  const camera = new THREE.OrthographicCamera(-6, 6, 3.375, -3.375, 0.1, 60);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(COLORS.sky, COLORS.ground, 2.05));
  const sun = new THREE.DirectionalLight(COLORS.sun, 3.15);
  sun.position.set(5, 9, 8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(COLORS.fill, 0.9);
  fill.position.set(-6, 3, 7);
  scene.add(fill);

  const playerGlow = new THREE.PointLight(COLORS.playerGlow, 7.5, 7.5, 2);
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
      playerGlow.intensity = 6.6 + Math.sin(Number(elapsed || 0) * 4.2) * 0.7;
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
    version: 'seed-man-three-world-v1',
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
