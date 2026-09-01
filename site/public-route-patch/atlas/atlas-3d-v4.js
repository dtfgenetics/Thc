import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = '/atlas/models/cannabis-specimen-v1.glb';
const HOTSPOT_URL = '/atlas/data/hotspots-v4.json';

const DEFAULT_HOTSPOTS = [
  {
    id: 'root-system',
    label: 'Root system',
    detail: 'Primary, lateral & fine absorbing roots',
    route: '/atlas/root-system/',
    copy: 'Primary and lateral roots branch into fine absorbing roots that anchor the plant, acquire water and ions, respire, and interact with the rhizosphere.',
    anchors: [[0.5, 0.08, 0.5]],
    radius: 0.19,
    focus: 0.42,
  },
  {
    id: 'stem-vascular',
    label: 'Stem & vascular system',
    detail: 'Main stem, branches, xylem & phloem pathway',
    route: '/atlas/stem-vascular/',
    copy: 'The main stem and branches form a continuous vascular skeleton. Xylem moves water and minerals; phloem redistributes sugars and other assimilates among sources and sinks.',
    anchors: [[0.5, 0.34, 0.5], [0.5, 0.52, 0.5]],
    radius: 0.105,
    focus: 0.48,
  },
  {
    id: 'nodes-branching',
    label: 'Nodes, meristems & branching',
    detail: 'Axillary sites and branch junctions',
    route: '/atlas/nodes-branching/',
    copy: 'Nodes carry leaves, branches, and axillary meristems. Their spacing and bud activity reveal how growth regulators and environment shape plant architecture.',
    anchors: [[0.5, 0.45, 0.5], [0.5, 0.59, 0.5], [0.5, 0.69, 0.5]],
    radius: 0.12,
    focus: 0.42,
  },
  {
    id: 'leaf-module',
    label: 'Fan leaves',
    detail: 'Serrated leaflets, petioles, midribs & lateral veins',
    route: '/atlas/leaf-module/',
    copy: 'Serrated leaflets connect through petioles to the vascular system. Midribs and lateral veins distribute water, minerals, sugars, and mechanical support through the blade.',
    anchors: [[0.27, 0.46, 0.5], [0.73, 0.48, 0.5], [0.3, 0.64, 0.5], [0.7, 0.66, 0.5]],
    radius: 0.17,
    focus: 0.46,
  },
  {
    id: 'flower-anatomy',
    label: 'Flowers & inflorescences',
    detail: 'Bracts, sugar leaves & floral clusters',
    route: '/atlas/flower-anatomy/',
    copy: 'Layered bracts, sugar leaves, stigmas, and dense glandular surfaces form the visible inflorescence. Floral structure changes through pollination and maturation.',
    anchors: [[0.5, 0.88, 0.5], [0.34, 0.73, 0.5], [0.66, 0.74, 0.5]],
    radius: 0.14,
    focus: 0.35,
  },
  {
    id: 'trichomes-resin',
    label: 'Glandular trichomes',
    detail: 'Stalks and secretory gland heads',
    route: '/atlas/trichomes-resin/',
    copy: 'Glandular trichomes include stalks, secretory disc cells, and gland heads. Their form and density vary by tissue, developmental stage, and genotype.',
    anchors: [[0.5, 0.91, 0.5]],
    radius: 0.075,
    focus: 0.24,
    priority: 20,
  },
  {
    id: 'reproductive-biology',
    label: 'Reproductive structures',
    detail: 'Stigmas, preflowers & pollen-reception surfaces',
    route: '/atlas/reproductive-biology/',
    copy: 'Stigmas and preflowers connect visible floral anatomy to sex expression, pollen reception, fertilization, embryo development, and seed formation.',
    anchors: [[0.46, 0.72, 0.5], [0.54, 0.77, 0.5]],
    radius: 0.09,
    focus: 0.3,
    priority: 15,
  },
];

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (probe.getContext('webgl2') || probe.getContext('webgl')));
  } catch {
    return false;
  }
}

async function loadHotspots() {
  try {
    const response = await fetch(HOTSPOT_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Hotspot data ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.hotspots) || data.hotspots.length < 7) throw new Error('Hotspot data incomplete');
    return data.hotspots;
  } catch (error) {
    console.warn('[Plant Atlas V4] Using embedded hotspot map.', error);
    return DEFAULT_HOTSPOTS;
  }
}

function normalizeModel(model, targetHeight = 6) {
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0) throw new Error('Loaded GLB has invalid bounds.');

  const scale = targetHeight / initialSize.y;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  return new THREE.Box3().setFromObject(model);
}

function normalizedPoint(bounds, value) {
  const size = bounds.getSize(new THREE.Vector3());
  return new THREE.Vector3(
    bounds.min.x + size.x * THREE.MathUtils.clamp(value[0], 0, 1),
    bounds.min.y + size.y * THREE.MathUtils.clamp(value[1], 0, 1),
    bounds.min.z + size.z * THREE.MathUtils.clamp(value[2], 0, 1),
  );
}

function prepareModelMaterials(model, renderer) {
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.filter(Boolean).forEach((material) => {
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
        material.map.anisotropy = maxAnisotropy;
      }
      if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    });
  });
}

export async function bootPhotorealAtlas() {
  const host = document.querySelector('[data-plant-3d]');
  const canvas = document.querySelector('[data-plant-canvas]');
  if (!host || !canvas || !supportsWebGL()) return false;

  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(MODEL_URL);
  } catch (error) {
    console.info('[Plant Atlas V4] Photoreal GLB unavailable; V3 fallback will load.', error);
    return false;
  }

  const hotspots = await loadHotspots();
  const fallback = document.querySelector('[data-plant-fallback]');
  const tooltip = document.querySelector('[data-plant-tooltip]');
  const inspector = document.querySelector('[data-plant-inspector]');
  const inspectorKicker = document.querySelector('[data-inspector-kicker]');
  const inspectorTitle = document.querySelector('[data-inspector-title]');
  const inspectorCopy = document.querySelector('[data-inspector-copy]');
  const inspectorLink = document.querySelector('[data-inspector-link]');
  const resetButton = document.querySelector('[data-plant-reset]');
  const focusButtons = [...document.querySelectorAll('[data-plant-focus]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  host.dataset.rendererGeneration = 'v4-photoreal';
  host.dataset.modelMode = 'photoreal-glb';
  host.dataset.modelSource = MODEL_URL;
  host.dataset.plantInspection = 'whole';
  host.dataset.rootCutaway = 'resting';
  host.dataset.isolation = 'off';
  host.dataset.venation = 'modeled';
  if (fallback) fallback.hidden = true;
  if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const anatomyLabel = document.createElement('div');
  anatomyLabel.dataset.plantAnatomyLabel = '';
  anatomyLabel.hidden = true;
  anatomyLabel.setAttribute('aria-live', 'polite');
  Object.assign(anatomyLabel.style, {
    position: 'absolute', zIndex: '12', maxWidth: '250px', padding: '8px 11px',
    border: '1px solid rgba(184,238,210,.32)', borderRadius: '12px',
    background: 'rgba(4,20,22,.88)', boxShadow: '0 10px 28px rgba(0,0,0,.28)',
    color: '#f0fff5', fontSize: '12px', fontWeight: '800', letterSpacing: '.02em',
    lineHeight: '1.35', pointerEvents: 'none', transform: 'translate(-50%, calc(-100% - 18px))',
    backdropFilter: 'blur(8px)',
  });
  host.appendChild(anatomyLabel);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07151b, 0.018);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const model = gltf.scene;
  prepareModelMaterials(model, renderer);
  scene.add(model);
  const bounds = normalizeModel(model, 6);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(2.7, size.x * 0.62), 72),
    new THREE.MeshStandardMaterial({ color: 0x06191e, roughness: 0.96, transparent: true, opacity: 0.7 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = bounds.min.y - 0.025;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0xd9f7ff, 0x19311d, 1.7));
  const key = new THREE.DirectionalLight(0xfff8e8, 4.2);
  key.position.set(4.8, 8.5, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 30;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x83b7ff, 1.15);
  fill.position.set(-5, 4, 4);
  scene.add(fill);
  const rim = new THREE.PointLight(0x68e3ff, 12, 20, 2);
  rim.position.set(-5, 5.5, -4);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  const homeTarget = center.clone();
  homeTarget.y = bounds.min.y + size.y * 0.5;
  const homeDistance = Math.max(7.4, sphere.radius * 2.35);
  const homeCamera = homeTarget.clone().add(new THREE.Vector3(homeDistance * 0.52, homeDistance * 0.27, homeDistance * 0.82));
  camera.position.copy(homeCamera);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = Math.max(0.5, sphere.radius * 0.22);
  controls.maxDistance = Math.max(14, sphere.radius * 4.2);
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 2.2;
  controls.target.copy(homeTarget);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.26;

  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xa8f2ce,
    transparent: true,
    opacity: 0,
    wireframe: true,
    depthWrite: false,
    depthTest: false,
  });
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
  const semantic = new Map();
  const hitVolumes = [];

  hotspots.forEach((meta) => {
    const group = new THREE.Group();
    group.userData.meta = meta;
    group.userData.anchors = [];
    const anchors = Array.isArray(meta.anchors) && meta.anchors.length ? meta.anchors : [[0.5, 0.5, 0.5]];
    anchors.forEach((anchorValue) => {
      const point = normalizedPoint(bounds, anchorValue);
      group.userData.anchors.push(point);
      const radius = Math.max(0.075, size.y * Number(meta.radius || 0.1));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), hitMaterial.clone());
      hit.position.copy(point);
      hit.userData.semanticGroup = group;
      hit.userData.priority = Number(meta.priority || 0);
      group.add(hit);
      hitVolumes.push(hit);

      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.03, 12, 8), highlightMaterial.clone());
      halo.position.copy(point);
      halo.userData.highlightHalo = true;
      group.add(halo);
    });
    semantic.set(meta.id, group);
    scene.add(group);
  });

  let hovered = null;
  let selected = null;
  let pointerDown = null;
  let cameraGoal = null;
  let targetGoal = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);

  function setHaloState(group, state) {
    group?.traverse((object) => {
      if (!object.userData.highlightHalo || !object.material) return;
      object.material.opacity = state === 'selected' ? 0.28 : state === 'hover' ? 0.16 : 0;
    });
  }

  function refreshHighlights() {
    semantic.forEach((group) => {
      if (group === selected) setHaloState(group, 'selected');
      else if (group === hovered) setHaloState(group, 'hover');
      else setHaloState(group, 'off');
    });
  }

  function updateInspectionState(group) {
    const id = group?.userData?.meta?.id || 'whole';
    host.dataset.plantInspection = id;
    host.dataset.rootCutaway = id === 'root-system' ? 'active' : 'resting';
    host.dataset.isolation = group ? 'active' : 'off';
  }

  function describe(group, mode = 'hover') {
    const meta = group?.userData?.meta;
    if (!meta) return;
    if (tooltip) {
      tooltip.innerHTML = `<strong>${meta.label}</strong><span>${mode === 'selected' ? 'Selected structure · inspect and zoom' : 'Click to inspect this structure'}</span>`;
      tooltip.hidden = false;
    }
    if (inspector) {
      inspectorKicker.textContent = mode === 'selected' ? 'Selected structure' : '3D plant structure';
      inspectorTitle.textContent = meta.label;
      inspectorCopy.textContent = meta.copy;
      inspectorLink.href = meta.route;
      inspectorLink.textContent = `Open ${meta.label} module →`;
      inspector.classList.add('active');
    }
    if (mode === 'selected') {
      anatomyLabel.innerHTML = `<strong>${meta.label}</strong><br><span style="font-weight:600;color:#b8d8c4">${meta.detail || 'Living plant anatomy'}</span>`;
      anatomyLabel.hidden = false;
    }
  }

  function labelAnchor(group) {
    const anchors = group?.userData?.anchors || [];
    if (!anchors.length) return center.clone();
    return anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
  }

  function updateAnatomyLabel() {
    if (!selected) return;
    const anchor = labelAnchor(selected).clone();
    anchor.y += size.y * 0.045;
    anchor.project(camera);
    if (anchor.z < -1 || anchor.z > 1) {
      anatomyLabel.hidden = true;
      return;
    }
    anatomyLabel.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    anatomyLabel.style.left = `${rect.left - hostRect.left + (anchor.x * 0.5 + 0.5) * rect.width}px`;
    anatomyLabel.style.top = `${rect.top - hostRect.top + (-anchor.y * 0.5 + 0.5) * rect.height}px`;
  }

  function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function hitTest(event) {
    pointerToCanvas(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitVolumes, false);
    if (!hits.length) return null;
    hits.sort((a, b) => {
      const pa = Number(a.object.userData.priority || 0);
      const pb = Number(b.object.userData.priority || 0);
      return pb - pa || a.distance - b.distance;
    });
    return hits[0].object.userData.semanticGroup || null;
  }

  function focusSystem(id) {
    if (id === 'whole') {
      resetView();
      return;
    }
    const group = semantic.get(id);
    if (!group) return;
    selected = group;
    hovered = null;
    controls.autoRotate = false;
    refreshHighlights();
    updateInspectionState(group);
    describe(group, 'selected');

    const target = labelAnchor(group);
    const focusFactor = THREE.MathUtils.clamp(Number(group.userData.meta?.focus || 0.4), 0.18, 0.7);
    const distance = Math.max(0.55, sphere.radius * focusFactor);
    const direction = camera.position.clone().sub(controls.target).normalize();
    cameraGoal = target.clone().add(direction.multiplyScalar(distance));
    targetGoal = target.clone();
    if (id === 'root-system') cameraGoal.y = Math.max(bounds.min.y + size.y * 0.14, target.y + size.y * 0.14);
    if (reducedMotion) {
      camera.position.copy(cameraGoal);
      controls.target.copy(targetGoal);
      cameraGoal = null;
      targetGoal = null;
    }
  }

  function resetView() {
    selected = null;
    hovered = null;
    controls.autoRotate = !reducedMotion;
    updateInspectionState(null);
    refreshHighlights();
    focusButtons.forEach((button) => button.classList.remove('active'));
    if (tooltip) tooltip.hidden = true;
    anatomyLabel.hidden = true;
    inspector?.classList.remove('active');
    if (reducedMotion) {
      camera.position.copy(homeCamera);
      controls.target.copy(homeTarget);
      cameraGoal = null;
      targetGoal = null;
    } else {
      cameraGoal = homeCamera.clone();
      targetGoal = homeTarget.clone();
    }
  }

  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    cameraGoal = null;
    targetGoal = null;
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
    controls.autoRotate = false;
    cameraGoal = null;
    targetGoal = null;
  });

  canvas.addEventListener('pointermove', (event) => {
    if (isTouch) return;
    const next = hitTest(event);
    if (next === hovered) return;
    hovered = next;
    refreshHighlights();
    if (hovered) {
      describe(hovered, selected === hovered ? 'selected' : 'hover');
      canvas.style.cursor = 'pointer';
    } else {
      if (tooltip) tooltip.hidden = true;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    refreshHighlights();
    if (tooltip) tooltip.hidden = true;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 7) return;
    const group = hitTest(event);
    if (!group) return;
    selected = group;
    hovered = group;
    refreshHighlights();
    updateInspectionState(group);
    describe(group, 'selected');
    focusSystem(group.userData.meta.id);
  });

  focusButtons.forEach((button) => button.addEventListener('click', () => {
    focusSystem(button.dataset.plantFocus);
    focusButtons.forEach((item) => item.classList.toggle('active', item === button && button.dataset.plantFocus !== 'whole'));
  }));
  resetButton?.addEventListener('click', resetView);

  function resize() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(420, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let active = true;
  const visibility = new IntersectionObserver(([entry]) => {
    active = Boolean(entry?.isIntersecting);
  }, { rootMargin: '180px' });
  visibility.observe(host);

  renderer.setAnimationLoop(() => {
    if (!active) return;
    if (cameraGoal && targetGoal) {
      camera.position.lerp(cameraGoal, 0.075);
      controls.target.lerp(targetGoal, 0.09);
      if (camera.position.distanceTo(cameraGoal) < 0.02 && controls.target.distanceTo(targetGoal) < 0.015) {
        cameraGoal = null;
        targetGoal = null;
      }
    }
    controls.update();
    updateAnatomyLabel();
    renderer.render(scene, camera);
  });

  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    visibility.disconnect();
    controls.dispose();
    anatomyLabel.remove();
    environment.dispose();
    pmrem.dispose();
    scene.traverse((object) => {
      object.geometry?.dispose?.();
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => material.dispose?.());
    });
    renderer.dispose();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  return true;
}
