import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const HOTSPOT_URL = '/atlas/data/hotspots-v4.json';
const MODEL_MANIFEST_URL = '/atlas/models/model-manifest-v4.json';
const DEFAULT_MODEL_URL = '/atlas/models/cannabis-specimen-v1.glb';

export const PLANT_ATLAS_V4_VERSION = '4.2.1';

const DEFAULT_HOTSPOTS = [
  { id: 'root-system', label: 'Root system', detail: 'Primary, lateral & fine absorbing roots', route: '/atlas/root-system/', copy: 'Primary and lateral roots branch into fine absorbing roots that anchor the plant, acquire water and ions, respire, and interact with the rhizosphere.', anchors: [[0.5, 0.12, 0.5]], radius: 0.13, focus: 0.44 },
  { id: 'stem-vascular', label: 'Stem & vascular system', detail: 'Main stem, branches, xylem & phloem pathway', route: '/atlas/stem-vascular/', copy: 'The main stem and branches form a continuous vascular skeleton. Xylem moves water and minerals; phloem redistributes sugars and other assimilates among sources and sinks.', anchors: [[0.5, 0.38, 0.5], [0.5, 0.57, 0.5]], radius: 0.075, focus: 0.42 },
  { id: 'leaf-module', label: 'Fan leaves', detail: 'Serrated leaflets, petioles, blades & veins', route: '/atlas/leaf-module/', copy: 'Fan leaves are major photosynthetic organs. Their blades capture light while stomata regulate gas exchange and transpiration, and petioles connect each leaf to the vascular system.', anchors: [[0.28, 0.52, 0.5], [0.72, 0.55, 0.5], [0.31, 0.69, 0.52], [0.69, 0.72, 0.48]], radius: 0.12, focus: 0.39 },
  { id: 'flower-anatomy', label: 'Flowers & inflorescences', detail: 'Female floral clusters, bracts & sugar leaves', route: '/atlas/flower-anatomy/', copy: 'Female inflorescences contain densely packed floral structures, subtending bracts, sugar leaves, stigmas, and resinous surfaces that change substantially through maturation.', anchors: [[0.5, 0.89, 0.5], [0.35, 0.78, 0.51], [0.66, 0.79, 0.49]], radius: 0.09, focus: 0.29 },
  { id: 'trichomes-resin', label: 'Glandular trichomes', detail: 'Stalks and secretory gland heads', route: '/atlas/trichomes-resin/', copy: 'Glandular trichomes include stalks, secretory disc cells, and gland heads. Their form and density vary by tissue, developmental stage, genotype, and environmental conditions.', anchors: [[0.52, 0.91, 0.48]], radius: 0.04, focus: 0.16, priority: 30 },
];

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (probe.getContext('webgl2') || probe.getContext('webgl')));
  } catch {
    return false;
  }
}

async function loadJSON(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[Plant Atlas V4] Could not load ${url}; using embedded defaults.`, error);
    return fallback;
  }
}

async function loadHotspots() {
  const data = await loadJSON(HOTSPOT_URL, { hotspots: DEFAULT_HOTSPOTS });
  return Array.isArray(data?.hotspots) && data.hotspots.length >= 5 ? data.hotspots : DEFAULT_HOTSPOTS;
}

async function loadModelManifest() {
  return loadJSON(MODEL_MANIFEST_URL, {
    schemaVersion: 1,
    preferredModel: { enabled: false, url: DEFAULT_MODEL_URL, label: 'Production photoreal Cannabis specimen' },
    fallback: { mode: 'procedural-pbr', label: 'Built-in high-detail PBR botanical specimen' },
  });
}

function createSeededRandom(seed = 0x50c9a7) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createCanvasTexture(draw, width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function buildProceduralTextures() {
  const random = createSeededRandom(0x51eed);
  const leaf = createCanvasTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, h, w, 0);
    gradient.addColorStop(0, '#15391f');
    gradient.addColorStop(0.45, '#2c7036');
    gradient.addColorStop(1, '#579c4f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 2600; i += 1) {
      const value = Math.floor(68 + random() * 92);
      ctx.fillStyle = `rgb(${Math.floor(value * 0.42)},${value},${Math.floor(value * 0.46)})`;
      const size = 0.45 + random() * 1.7;
      ctx.fillRect(random() * w, random() * h, size, size);
    }
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#c6dda9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, 0);
    ctx.stroke();
  });
  const stem = createCanvasTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#314f2d');
    gradient.addColorStop(0.5, '#768f5a');
    gradient.addColorStop(1, '#294329');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#d6cb98';
    for (let x = 10; x < w; x += 20 + random() * 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 9, h * 0.33, x - 7, h * 0.66, x + 4, h);
      ctx.stroke();
    }
  });
  const root = createCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c8b496';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 1000; i += 1) {
      const tone = Math.floor(145 + random() * 72);
      ctx.fillStyle = `rgb(${tone},${Math.floor(tone * 0.91)},${Math.floor(tone * 0.73)})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 3);
    }
  });
  const flower = createCanvasTexture((ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.4, 8, w * 0.5, h * 0.5, w * 0.68);
    gradient.addColorStop(0, '#98b975');
    gradient.addColorStop(0.48, '#64854d');
    gradient.addColorStop(1, '#304b2c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#eef0d6';
    for (let i = 0; i < 720; i += 1) ctx.fillRect(random() * w, random() * h, 1, 1);
  });
  return { leaf, stem, root, flower };
}

function serratedLeafletGeometry(length = 1, width = 0.2, teeth = 10) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const side = [];
  const samples = teeth * 2;
  for (let i = 1; i <= samples; i += 1) {
    const t = i / (samples + 1);
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.78) * (1 - t * 0.25);
    const tooth = i % 2 === 0 ? 0.72 : 1;
    side.push([width * envelope * tooth, length * t]);
  }
  side.forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(0, length);
  for (let i = side.length - 1; i >= 0; i -= 1) shape.lineTo(-side[i][0], side[i][1]);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 1);
  geometry.computeVertexNormals();
  return geometry;
}

function tubeBetween(points, radius, material, tubularSegments = 14, radialSegments = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.isVector3 ? point : new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinderBetween(a, b, radius, material, radialSegments = 10) {
  const start = a.isVector3 ? a : new THREE.Vector3(...a);
  const end = b.isVector3 ? b : new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, direction.length(), radialSegments), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildProceduralSpecimen({ renderer, isTouch }) {
  const textures = buildProceduralTextures();
  const random = createSeededRandom(0xc4aab15);
  const rootMaterial = new THREE.MeshStandardMaterial({ map: textures.root, color: 0xe1d0b6, roughness: 0.93, metalness: 0 });
  const stemMaterial = new THREE.MeshStandardMaterial({ map: textures.stem, color: 0x758d58, roughness: 0.76, metalness: 0 });
  const leafMaterial = new THREE.MeshPhysicalMaterial({ map: textures.leaf, color: 0x55944d, roughness: 0.61, metalness: 0, clearcoat: 0.035, side: THREE.DoubleSide });
  const flowerMaterial = new THREE.MeshPhysicalMaterial({ map: textures.flower, color: 0x78985e, roughness: 0.66, metalness: 0, clearcoat: 0.07 });
  const sugarLeafMaterial = leafMaterial.clone();
  sugarLeafMaterial.color.setHex(0x6e9659);
  sugarLeafMaterial.roughness = 0.5;
  const stigmaMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c5a0, roughness: 0.5, emissive: 0x3b1505, emissiveIntensity: 0.05 });
  const trichomeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf4fff0, roughness: 0.16, transmission: 0.1, transparent: true, opacity: 0.84, clearcoat: 0.34 });
  const veinMaterial = new THREE.LineBasicMaterial({ color: 0xb9dca6, transparent: true, opacity: 0.44 });
  Object.values(textures).forEach((texture) => { texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); });

  const model = new THREE.Group();
  model.name = 'CannabisSpecimenProceduralPBR';
  model.userData.plantAtlasGenerated = true;

  const roots = new THREE.Group();
  roots.name = 'Roots';
  roots.add(tubeBetween([
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(-0.03, -0.52, 0.02),
    new THREE.Vector3(0.02, -1.15, -0.05),
    new THREE.Vector3(0.05, -1.78, 0.04),
  ], 0.088, rootMaterial, 28, 10));
  const majorRootCount = isTouch ? 14 : 22;
  const finePerMajor = isTouch ? 4 : 6;
  for (let i = 0; i < majorRootCount; i += 1) {
    const angle = (i / majorRootCount) * Math.PI * 2 + (random() - 0.5) * 0.3;
    const yStart = -0.2 - random() * 0.95;
    const start = new THREE.Vector3((random() - 0.5) * 0.14, yStart, (random() - 0.5) * 0.14);
    const length = 0.82 + random() * 1.05;
    const end = new THREE.Vector3(Math.cos(angle) * length, yStart - 0.45 - random() * 0.62, Math.sin(angle) * length);
    const mid = start.clone().lerp(end, 0.52).add(new THREE.Vector3((random() - 0.5) * 0.3, (random() - 0.5) * 0.2, (random() - 0.5) * 0.3));
    roots.add(tubeBetween([start, mid, end], 0.02 + random() * 0.03, rootMaterial, 17, 6));
    for (let j = 0; j < finePerMajor; j += 1) {
      const t = 0.18 + (j / finePerMajor) * 0.7;
      const branchStart = new THREE.Vector3().lerpVectors(start, end, t);
      const sideAngle = angle + (random() > 0.5 ? 1 : -1) * (0.48 + random() * 0.9);
      const branchLength = 0.3 + random() * 0.55;
      const branchEnd = branchStart.clone().add(new THREE.Vector3(Math.cos(sideAngle) * branchLength, -0.18 - random() * 0.3, Math.sin(sideAngle) * branchLength));
      roots.add(tubeBetween([branchStart, branchStart.clone().lerp(branchEnd, 0.55).add(new THREE.Vector3(0, -0.055, 0)), branchEnd], 0.005 + random() * 0.007, rootMaterial, 10, 5));
    }
  }
  model.add(roots);

  const stem = new THREE.Group();
  stem.name = 'StemAndBranches';
  stem.add(tubeBetween([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.035, 1.5, -0.02),
    new THREE.Vector3(-0.025, 3.15, 0.025),
    new THREE.Vector3(0.025, 4.75, -0.01),
    new THREE.Vector3(0, 5.72, 0.015),
  ], 0.098, stemMaterial, 42, 12));

  const branchDefs = [
    [-1, 1.35, 1.72, 0.28], [1, 1.48, 1.76, -0.24],
    [-1, 1.95, 1.7, -0.3], [1, 2.08, 1.68, 0.27],
    [-1, 2.55, 1.58, 0.26], [1, 2.68, 1.56, -0.28],
    [-1, 3.12, 1.42, -0.24], [1, 3.25, 1.4, 0.24],
    [-1, 3.68, 1.23, 0.2], [1, 3.8, 1.22, -0.2],
    [-1, 4.15, 1.02, -0.16], [1, 4.27, 1.02, 0.16],
    [-1, 4.58, 0.78, 0.11], [1, 4.69, 0.78, -0.11],
  ];
  const branchEnds = [];
  branchDefs.forEach(([side, y, reach, z], index) => {
    const origin = new THREE.Vector3(0, y, 0);
    const end = new THREE.Vector3(side * reach, y + 0.68 + index * 0.012, z);
    const mid = origin.clone().lerp(end, 0.54).add(new THREE.Vector3(side * 0.07, 0.16, (random() - 0.5) * 0.11));
    stem.add(tubeBetween([origin, mid, end], Math.max(0.029, 0.057 - index * 0.0018), stemMaterial, 19, 8));
    const twig = end.clone().add(new THREE.Vector3(side * 0.2, 0.3, z * 0.14));
    stem.add(cylinderBetween(end.clone().lerp(origin, 0.035), twig, 0.021, stemMaterial, 7));
    branchEnds.push({ end, side, index, y });
  });
  model.add(stem);

  const nodes = new THREE.Group();
  nodes.name = 'Nodes';
  branchDefs.forEach(([, y], index) => {
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.095 + (index < 5 ? 0.012 : 0), 14, 9), stemMaterial);
    node.position.set(0, y, 0);
    node.scale.set(1.2, 0.72, 1.08);
    node.castShadow = true;
    nodes.add(node);
  });
  model.add(nodes);

  const lineFrom = (points) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), veinMaterial);
  function createFanLeaf(position, scale, yaw, pitch, roll = 0) {
    const fan = new THREE.Group();
    fan.name = 'FanLeaf';
    fan.add(cylinderBetween([0, -0.38, 0], [0, 0.035, 0], 0.014, stemMaterial, 6));
    const angles = [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];
    angles.forEach((angle, index) => {
      const distance = Math.abs(index - 4);
      const length = 1.16 - distance * 0.095;
      const width = 0.225 - distance * 0.012;
      const leaflet = new THREE.Group();
      const blade = new THREE.Mesh(serratedLeafletGeometry(length, width, 12), leafMaterial);
      blade.castShadow = true;
      blade.receiveShadow = true;
      leaflet.add(blade);
      leaflet.add(lineFrom([new THREE.Vector3(0, 0.02, 0.004), new THREE.Vector3(0, length * 0.94, 0.004)]));
      [0.23, 0.4, 0.57, 0.73].forEach((t) => {
        const spread = width * Math.sin(Math.PI * t) * 0.62;
        leaflet.add(lineFrom([new THREE.Vector3(0, length * t, 0.004), new THREE.Vector3(spread, length * t + length * 0.07, 0.004)]));
        leaflet.add(lineFrom([new THREE.Vector3(0, length * t, 0.004), new THREE.Vector3(-spread, length * t + length * 0.07, 0.004)]));
      });
      leaflet.rotation.z = angle;
      leaflet.rotation.x = (distance % 2 ? 0.045 : -0.025) + (random() - 0.5) * 0.04;
      fan.add(leaflet);
    });
    fan.position.copy(position);
    fan.scale.setScalar(scale);
    fan.rotation.set(pitch, yaw, roll);
    return fan;
  }

  const leaves = new THREE.Group();
  leaves.name = 'FanLeaves';
  branchEnds.forEach(({ end, side, index, y }) => {
    const scale = Math.max(0.48, 0.96 - index * 0.034);
    leaves.add(createFanLeaf(end.clone().add(new THREE.Vector3(side * 0.04, 0.015, 0)), scale, side < 0 ? -1.05 : 1.05, -0.52 + (random() - 0.5) * 0.14, side * -0.06));

    const inner = end.clone().multiplyScalar(0.6);
    inner.y = y + 0.4;
    leaves.add(createFanLeaf(inner, scale * 0.78, side < 0 ? -0.76 : 0.76, -0.45 + (random() - 0.5) * 0.1, side * 0.05));

    if (!isTouch && index < 10) {
      const middle = end.clone().multiplyScalar(0.8);
      middle.y = y + 0.55;
      middle.z += side * 0.12;
      leaves.add(createFanLeaf(middle, scale * 0.68, side < 0 ? -1.45 : 1.45, -0.34 + (random() - 0.5) * 0.12, side * -0.04));
    }
  });
  [4.72, 4.98, 5.22, 5.43].forEach((y, index) => {
    const scale = 0.62 - index * 0.08;
    leaves.add(createFanLeaf(new THREE.Vector3(index % 2 ? 0.12 : -0.12, y, index % 2 ? -0.08 : 0.08), scale, index % 2 ? 1.5 : -1.5, -0.38, index % 2 ? 0.05 : -0.05));
  });
  model.add(leaves);

  function createFlowerCluster(position, scale = 1, twist = 0) {
    const cluster = new THREE.Group();
    cluster.name = 'FemaleInflorescence';
    const bractGeometry = new THREE.IcosahedronGeometry(0.17, isTouch ? 1 : 2);
    const bractCount = isTouch ? 18 : 30;
    for (let i = 0; i < bractCount; i += 1) {
      const t = i / Math.max(1, bractCount - 1);
      const angle = i * 2.399963229728653;
      const envelope = 0.205 * (1 - t * 0.5);
      const bract = new THREE.Mesh(bractGeometry, flowerMaterial);
      bract.position.set(Math.cos(angle) * envelope * (0.72 + random() * 0.5), t * 0.84, Math.sin(angle) * envelope * (0.72 + random() * 0.5));
      const s = (0.8 + random() * 0.38) * (1 - t * 0.2);
      bract.scale.set(s * 0.86, s * 1.28, s * 0.94);
      bract.rotation.set((random() - 0.5) * 0.32, angle, (random() - 0.5) * 0.32);
      bract.castShadow = true;
      cluster.add(bract);
    }
    const sugarCount = isTouch ? 7 : 10;
    for (let i = 0; i < sugarCount; i += 1) {
      const sugar = new THREE.Mesh(serratedLeafletGeometry(0.43, 0.082, 7), sugarLeafMaterial);
      const angle = (i / sugarCount) * Math.PI * 2 + 0.28;
      sugar.position.set(Math.cos(angle) * 0.11, 0.16 + (i % 4) * 0.16, Math.sin(angle) * 0.11);
      sugar.rotation.set(-0.72 + (i % 2) * 0.13, angle, (i % 2 ? 1 : -1) * 0.14);
      sugar.scale.setScalar(0.86);
      sugar.castShadow = true;
      cluster.add(sugar);
    }
    const stigmaCount = isTouch ? 16 : 26;
    for (let i = 0; i < stigmaCount; i += 1) {
      const angle = (i / stigmaCount) * Math.PI * 2 + random() * 0.42;
      const y = 0.12 + random() * 0.66;
      const radial = 0.09 + random() * 0.09;
      const start = new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
      const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * (0.09 + random() * 0.09), 0.13 + random() * 0.12, Math.sin(angle) * (0.09 + random() * 0.09)));
      cluster.add(tubeBetween([start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.028, 0)), end], 0.006, stigmaMaterial, 6, 4));
    }
    cluster.position.copy(position);
    cluster.scale.setScalar(scale);
    cluster.rotation.y = twist;
    return cluster;
  }

  const flowers = new THREE.Group();
  flowers.name = 'Flowers';
  const flowerSpecs = [[new THREE.Vector3(0, 5.22, 0), 1.38, 0]];
  branchEnds.forEach(({ end, side, index }) => {
    if (index < 3 && isTouch) return;
    if (index < 2 && !isTouch) return;
    const scale = Math.max(0.5, 0.82 - Math.abs(index - 8) * 0.028);
    const position = end.clone().add(new THREE.Vector3(side * 0.02, 0.05, 0));
    flowerSpecs.push([position, scale, side * (0.14 + index * 0.025)]);
  });
  flowerSpecs.forEach(([position, scale, twist]) => flowers.add(createFlowerCluster(position, scale, twist)));
  model.add(flowers);

  const trichomes = new THREE.Group();
  trichomes.name = 'VisibleTrichomes';
  const headGeometry = new THREE.SphereGeometry(0.016, 6, 5);
  const stalkGeometry = new THREE.CylinderGeometry(0.003, 0.004, 0.048, 5);
  const trichomeCount = isTouch ? 100 : 240;
  for (let i = 0; i < trichomeCount; i += 1) {
    const [position, scale] = flowerSpecs[i % flowerSpecs.length];
    const angle = random() * Math.PI * 2;
    const y = (0.12 + random() * 0.7) * scale;
    const radial = (0.11 + random() * 0.14) * scale;
    const base = position.clone().add(new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial));
    const stalk = new THREE.Mesh(stalkGeometry, trichomeMaterial);
    stalk.position.copy(base).add(new THREE.Vector3(0, 0.024, 0));
    stalk.scale.setScalar(Math.max(0.65, scale));
    const head = new THREE.Mesh(headGeometry, trichomeMaterial);
    head.position.copy(base).add(new THREE.Vector3(0, 0.057 * Math.max(0.65, scale), 0));
    head.scale.setScalar(Math.max(0.7, scale));
    trichomes.add(stalk, head);
  }
  model.add(trichomes);

  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return model;
}

function normalizeModel(model, targetHeight = 6.4) {
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0) throw new Error('Plant model has invalid bounds.');
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
    bounds.min.x + size.x * THREE.MathUtils.clamp(Number(value?.[0]) || 0, 0, 1),
    bounds.min.y + size.y * THREE.MathUtils.clamp(Number(value?.[1]) || 0, 0, 1),
    bounds.min.z + size.z * THREE.MathUtils.clamp(Number(value?.[2]) || 0, 0, 1),
  );
}

function prepareExternalMaterials(model, renderer) {
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
      if ('side' in material && material.alphaTest > 0) material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
}

async function resolveSpecimen({ renderer, isTouch, manifest, status }) {
  const preferred = manifest?.preferredModel || {};
  const enabled = preferred.enabled === true && typeof preferred.url === 'string' && preferred.url.length > 0;
  if (enabled) {
    status(`Loading ${preferred.label || 'photoreal specimen'}…`, 'loading');
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(preferred.url);
      if (!gltf?.scene) throw new Error('GLB did not contain a scene.');
      prepareExternalMaterials(gltf.scene, renderer);
      return { model: gltf.scene, mode: 'external-glb', source: preferred.url, label: preferred.label || 'Photoreal GLB specimen' };
    } catch (error) {
      console.warn('[Plant Atlas V4] Preferred GLB failed; using built-in PBR specimen.', error);
      status('External specimen unavailable · using built-in PBR model', 'fallback');
    }
  }
  const label = manifest?.fallback?.label || 'Built-in high-detail PBR botanical specimen';
  return { model: buildProceduralSpecimen({ renderer, isTouch }), mode: 'procedural-pbr', source: 'built-in://plant-atlas-v4', label };
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

export async function bootPhotorealAtlas() {
  const host = document.querySelector('[data-plant-3d]');
  const canvas = document.querySelector('[data-plant-canvas]');
  if (!host || !canvas) return false;
  if (!supportsWebGL()) {
    host.classList.add('no-webgl');
    const fallback = document.querySelector('[data-plant-fallback]');
    if (fallback) fallback.hidden = false;
    return false;
  }

  const fallback = document.querySelector('[data-plant-fallback]');
  const tooltip = document.querySelector('[data-plant-tooltip]');
  const inspector = document.querySelector('[data-plant-inspector]');
  const inspectorKicker = document.querySelector('[data-inspector-kicker]');
  const inspectorTitle = document.querySelector('[data-inspector-title]');
  const inspectorCopy = document.querySelector('[data-inspector-copy]');
  const inspectorLink = document.querySelector('[data-inspector-link]');
  const resetButton = document.querySelector('[data-plant-reset]');
  const focusButtons = [...document.querySelectorAll('[data-plant-focus]')];
  const modelStatus = document.querySelector('[data-plant-model-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
  const qualityTier = isTouch || lowMemory ? 'mobile' : 'desktop';
  const targetFps = THREE.MathUtils.clamp(Number(document.documentElement.dataset.plantAtlasFrameRate || (qualityTier === 'mobile' ? 24 : 40)), 1, 60);
  const frameInterval = 1000 / targetFps;

  const setStatus = (message, state = 'ready') => {
    if (!modelStatus) return;
    modelStatus.textContent = message;
    modelStatus.dataset.state = state;
  };

  host.dataset.rendererGeneration = 'v4';
  host.dataset.renderState = 'loading';
  host.dataset.controlsReady = 'false';
  host.dataset.qualityTier = qualityTier;
  host.dataset.plantInspection = 'whole';
  host.dataset.rootCutaway = 'resting';
  host.dataset.isolation = 'off';
  host.dataset.venation = 'modeled';
  if (fallback) fallback.hidden = true;
  if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityTier === 'mobile' ? 1.2 : 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07110a, 0.015);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const [hotspots, manifest] = await Promise.all([loadHotspots(), loadModelManifest()]);
  const specimen = await resolveSpecimen({ renderer, isTouch: qualityTier === 'mobile', manifest, status: setStatus });
  const model = specimen.model;
  scene.add(model);
  const bounds = normalizeModel(model, 6.4);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  host.dataset.modelMode = specimen.mode;
  host.dataset.modelSource = specimen.source;

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(3.1, size.x * 0.72), 72),
    new THREE.MeshStandardMaterial({ color: 0x07120c, roughness: 0.99, transparent: true, opacity: 0.74 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = bounds.min.y - 0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0xf2f0df, 0x172719, 1.55));
  const key = new THREE.DirectionalLight(0xfff7e5, qualityTier === 'mobile' ? 3.1 : 4.0);
  key.position.set(4.8, 8.8, 5.4);
  key.castShadow = qualityTier !== 'mobile';
  key.shadow.mapSize.set(qualityTier === 'mobile' ? 1024 : 2048, qualityTier === 'mobile' ? 1024 : 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 30;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9d9b7, 0.95);
  fill.position.set(-5, 4.4, 4.2);
  scene.add(fill);
  const rim = new THREE.PointLight(0xdce8b9, 6.4, 20, 2);
  rim.position.set(-4.8, 5.8, -4.5);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffdfae, 4.2, 14, 2);
  warm.position.set(4.2, 3.1, 3.2);
  scene.add(warm);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.04, 80);
  const homeTarget = center.clone();
  homeTarget.y = bounds.min.y + size.y * 0.49;
  const homeDirection = new THREE.Vector3(0.38, 0.12, 0.92).normalize();
  const fittedHomeCamera = (aspect) => {
    const safeAspect = Math.max(0.55, Number(aspect) || 1);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * safeAspect);
    const fitHeight = size.y / (2 * Math.tan(verticalFov * 0.5));
    const fitWidth = size.x / (2 * Math.tan(horizontalFov * 0.5));
    const distance = Math.max(fitHeight, fitWidth, sphere.radius * 1.75) * 1.16;
    return homeTarget.clone().add(homeDirection.clone().multiplyScalar(distance));
  };
  const initialRect = host.getBoundingClientRect();
  const initialAspect = initialRect.width / Math.max(1, initialRect.height);
  camera.aspect = Math.max(0.55, initialAspect || 1);
  camera.updateProjectionMatrix();
  const homeCamera = fittedHomeCamera(camera.aspect);
  camera.position.copy(homeCamera);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = Math.max(0.48, sphere.radius * 0.19);
  controls.maxDistance = Math.max(18, homeCamera.distanceTo(homeTarget) * 2.35);
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 2.25;
  controls.target.copy(homeTarget);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.2;

  const anatomyLabel = document.createElement('div');
  anatomyLabel.dataset.plantAnatomyLabel = '';
  anatomyLabel.hidden = true;
  anatomyLabel.setAttribute('aria-live', 'polite');
  anatomyLabel.className = 'plant-anatomy-label';
  host.appendChild(anatomyLabel);

  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xa8f2ce, transparent: true, opacity: 0, wireframe: true, depthWrite: false, depthTest: false });
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
      const radius = Math.max(0.055, size.y * Number(meta.radius || 0.075));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), hitMaterial.clone());
      hit.position.copy(point);
      hit.userData.semanticGroup = group;
      hit.userData.priority = Number(meta.priority || 0);
      group.add(hit);
      hitVolumes.push(hit);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.03, 12, 8), haloMaterial.clone());
      halo.position.copy(point);
      halo.userData.highlightHalo = true;
      group.add(halo);
    });
    semantic.set(meta.id, group);
    scene.add(group);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  let hovered = null;
  let selected = null;
  let pointerDown = null;
  let cameraGoal = null;
  let targetGoal = null;
  let active = true;
  let disposed = false;
  let lastRenderAt = -Infinity;

  function setHaloState(group, state) {
    group?.traverse((object) => {
      if (!object.userData.highlightHalo || !object.material) return;
      object.material.opacity = state === 'selected' ? 0.32 : state === 'hover' ? 0.18 : 0;
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
    host.dataset.rootCutaway = id.startsWith('root') ? 'active' : 'resting';
    host.dataset.isolation = group ? 'active' : 'off';
  }

  function describe(group, mode = 'hover') {
    const meta = group?.userData?.meta;
    if (!meta) return;
    if (tooltip) {
      tooltip.innerHTML = `<strong>${escapeHTML(meta.label)}</strong><span>${mode === 'selected' ? 'Selected · zoomed for inspection' : 'Click to inspect this structure'}</span>`;
      tooltip.hidden = false;
    }
    if (inspector && inspectorKicker && inspectorTitle && inspectorCopy && inspectorLink) {
      inspectorKicker.textContent = mode === 'selected' ? 'Selected structure' : '3D plant structure';
      inspectorTitle.textContent = meta.label;
      inspectorCopy.textContent = meta.copy;
      inspectorLink.href = meta.route;
      inspectorLink.textContent = `Open ${meta.label} module →`;
      inspector.classList.add('active');
    }
    if (mode === 'selected') {
      anatomyLabel.innerHTML = `<strong>${escapeHTML(meta.label)}</strong><span>${escapeHTML(meta.detail || 'Living plant anatomy')}</span>`;
      anatomyLabel.hidden = false;
    }
  }

  function labelAnchor(group) {
    const anchors = group?.userData?.anchors || [];
    if (!anchors.length) return center.clone();
    return anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
  }

  function updateAnatomyLabel() {
    if (!selected || anatomyLabel.hidden) return;
    const anchor = labelAnchor(selected).clone();
    anchor.y += size.y * 0.04;
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
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  function hitTest(event) {
    pointerToCanvas(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitVolumes, false);
    if (!hits.length) return null;
    hits.sort((a, b) => Number(b.object.userData.priority || 0) - Number(a.object.userData.priority || 0) || a.distance - b.distance);
    return hits[0].object.userData.semanticGroup || null;
  }

  function focusSystem(id) {
    if (id === 'whole') return resetView();
    const group = semantic.get(id);
    if (!group) return;
    selected = group;
    hovered = null;
    controls.autoRotate = false;
    refreshHighlights();
    updateInspectionState(group);
    describe(group, 'selected');
    focusButtons.forEach((button) => button.classList.toggle('active', button.dataset.plantFocus === id));
    const target = labelAnchor(group);
    const focusFactor = THREE.MathUtils.clamp(Number(group.userData.meta?.focus || 0.35), 0.13, 0.7);
    const distance = Math.max(0.52, sphere.radius * focusFactor);
    const direction = camera.position.clone().sub(controls.target).normalize();
    cameraGoal = target.clone().add(direction.multiplyScalar(distance));
    targetGoal = target.clone();
    if (id.startsWith('root')) cameraGoal.y = Math.max(bounds.min.y + size.y * 0.09, target.y + size.y * 0.12);
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

  function resize() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(420, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    homeCamera.copy(fittedHomeCamera(camera.aspect));
    controls.maxDistance = Math.max(18, homeCamera.distanceTo(homeTarget) * 2.35);
    if (host.dataset.plantInspection === 'whole' && !cameraGoal && !pointerDown) {
      camera.position.copy(homeCamera);
      controls.target.copy(homeTarget);
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
    if (group) focusSystem(group.userData.meta.id);
  });

  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (event) => {
    const orbitStep = 0.12;
    const zoomStep = 0.9;
    if (event.key === 'r' || event.key === 'R' || event.key === 'Home') {
      event.preventDefault();
      resetView();
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? orbitStep : -orbitStep);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      camera.position.lerp(controls.target, 1 - zoomStep);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      camera.position.sub(controls.target).multiplyScalar(1 / zoomStep).add(controls.target);
    }
  });

  focusButtons.forEach((button) => button.addEventListener('click', () => focusSystem(button.dataset.plantFocus)));
  resetButton?.addEventListener('click', resetView);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  const visibilityObserver = new IntersectionObserver(([entry]) => { active = Boolean(entry?.isIntersecting); }, { rootMargin: '180px' });
  visibilityObserver.observe(host);

  controls.update();
  renderer.render(scene, camera);
  host.dataset.controlsReady = 'true';
  host.dataset.renderState = 'ready';
  setStatus(`${specimen.label} · ${qualityTier} quality`, 'ready');

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    host.dataset.renderState = 'context-lost';
    host.dataset.controlsReady = 'false';
    setStatus('3D graphics context interrupted · reload to restore', 'error');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    host.dataset.controlsReady = 'true';
    host.dataset.renderState = 'ready';
    setStatus(`${specimen.label} · restored`, 'ready');
  });

  renderer.setAnimationLoop((time) => {
    if (!active || disposed) return;
    if (time - lastRenderAt < frameInterval) return;
    lastRenderAt = time;
    if (cameraGoal && targetGoal) {
      camera.position.lerp(cameraGoal, 0.075);
      controls.target.lerp(targetGoal, 0.09);
      if (camera.position.distanceTo(cameraGoal) < 0.018 && controls.target.distanceTo(targetGoal) < 0.014) {
        cameraGoal = null;
        targetGoal = null;
      }
    }
    controls.update();
    updateAnatomyLabel();
    renderer.render(scene, camera);
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    controls.dispose();
    anatomyLabel.remove();
    environment.dispose();
    pmrem.dispose();
    const disposedGeometry = new Set();
    const disposedMaterial = new Set();
    scene.traverse((object) => {
      if (object.geometry && !disposedGeometry.has(object.geometry)) {
        disposedGeometry.add(object.geometry);
        object.geometry.dispose?.();
      }
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => {
        if (disposedMaterial.has(material)) return;
        disposedMaterial.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
        material.dispose?.();
      });
    });
    renderer.dispose();
  }

  window.addEventListener('pagehide', dispose, { once: true });
  return true;
}

export const bootPlantAtlasV4 = bootPhotorealAtlas;
