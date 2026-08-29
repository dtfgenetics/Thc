import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.querySelector('[data-plant-3d]');
const canvas = document.querySelector('[data-plant-canvas]');
const fallback = document.querySelector('[data-plant-fallback]');
const tooltip = document.querySelector('[data-plant-tooltip]');
const inspector = document.querySelector('[data-plant-inspector]');
const inspectorKicker = document.querySelector('[data-inspector-kicker]');
const inspectorTitle = document.querySelector('[data-inspector-title]');
const inspectorCopy = document.querySelector('[data-inspector-copy]');
const inspectorLink = document.querySelector('[data-inspector-link]');
const resetButton = document.querySelector('[data-plant-reset]');
const focusButtons = [...document.querySelectorAll('[data-plant-focus]')];

if (!host || !canvas) throw new Error('Plant Atlas 3D host is missing.');

const supportsWebGL = (() => {
  try {
    const probe = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (probe.getContext('webgl2') || probe.getContext('webgl')));
  } catch {
    return false;
  }
})();

if (!supportsWebGL) {
  host.classList.add('no-webgl');
  if (fallback) fallback.hidden = false;
} else {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  host.dataset.plantInspection = 'whole';
  host.dataset.rootCutaway = 'resting';
  host.dataset.isolation = 'off';
  host.dataset.venation = 'modeled';
  if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const anatomyLabel = document.createElement('div');
  anatomyLabel.dataset.plantAnatomyLabel = '';
  anatomyLabel.hidden = true;
  anatomyLabel.setAttribute('aria-live', 'polite');
  Object.assign(anatomyLabel.style, {
    position: 'absolute',
    zIndex: '12',
    maxWidth: '230px',
    padding: '8px 11px',
    border: '1px solid rgba(184,238,210,.32)',
    borderRadius: '12px',
    background: 'rgba(4,20,22,.86)',
    boxShadow: '0 10px 28px rgba(0,0,0,.28)',
    color: '#f0fff5',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '.02em',
    lineHeight: '1.35',
    pointerEvents: 'none',
    transform: 'translate(-50%, calc(-100% - 18px))',
    backdropFilter: 'blur(8px)'
  });
  host.appendChild(anatomyLabel);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.3 : 1.7));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07151b, 0.032);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const homeCamera = new THREE.Vector3(5.7, 3.9, 8.25);
  const homeTarget = new THREE.Vector3(0, 2.05, 0);
  camera.position.copy(homeCamera);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 12;
  controls.minPolarAngle = 0.36;
  controls.maxPolarAngle = 1.76;
  controls.target.copy(homeTarget);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.34;

  scene.add(new THREE.HemisphereLight(0xcaf5ff, 0x142d1b, 2.15));
  const key = new THREE.DirectionalLight(0xf4ffe9, 3.5);
  key.position.set(4.5, 8.2, 5.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6fb7ff, 1.25);
  fill.position.set(-5, 3, 4);
  scene.add(fill);
  const rim = new THREE.PointLight(0x46dfff, 17, 18, 2);
  rim.position.set(-5, 5, -4);
  scene.add(rim);
  const warm = new THREE.PointLight(0xf1b96a, 9, 12, 2);
  warm.position.set(4, 2.4, 2.2);
  scene.add(warm);

  const plant = new THREE.Group();
  plant.rotation.y = -0.2;
  scene.add(plant);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 72),
    new THREE.MeshStandardMaterial({ color: 0x06191e, roughness: 1, transparent: true, opacity: 0.86 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.055;
  scene.add(ground);

  const soilHalo = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 2.33, 96),
    new THREE.MeshBasicMaterial({ color: 0x2ca7c0, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  soilHalo.rotation.x = -Math.PI / 2;
  soilHalo.position.y = -0.04;
  scene.add(soilHalo);

  const materials = {
    stem: new THREE.MeshStandardMaterial({ color: 0x587f49, roughness: 0.76, metalness: 0.02 }),
    stemHover: new THREE.MeshStandardMaterial({ color: 0xa9e780, emissive: 0x244818, emissiveIntensity: 0.9, roughness: 0.52 }),
    root: new THREE.MeshStandardMaterial({ color: 0xd8c9aa, roughness: 0.9 }),
    rootHover: new THREE.MeshStandardMaterial({ color: 0xffe6ae, emissive: 0x5b3d18, emissiveIntensity: 0.7, roughness: 0.7 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x347e43, roughness: 0.7, side: THREE.DoubleSide }),
    leafHover: new THREE.MeshStandardMaterial({ color: 0x75d56e, emissive: 0x164d1b, emissiveIntensity: 0.95, roughness: 0.52, side: THREE.DoubleSide }),
    vein: new THREE.LineBasicMaterial({ color: 0xa8d79d, transparent: true, opacity: 0.74 }),
    flower: new THREE.MeshStandardMaterial({ color: 0x6f9c50, roughness: 0.83 }),
    flowerHover: new THREE.MeshStandardMaterial({ color: 0xb5d873, emissive: 0x3c511a, emissiveIntensity: 0.9, roughness: 0.62 }),
    node: new THREE.MeshStandardMaterial({ color: 0x9acb72, roughness: 0.56 }),
    nodeHover: new THREE.MeshStandardMaterial({ color: 0xe1ff99, emissive: 0x46601c, emissiveIntensity: 0.9, roughness: 0.42 }),
    resin: new THREE.MeshStandardMaterial({ color: 0xe8fbec, emissive: 0x5fe7df, emissiveIntensity: 1.25, roughness: 0.2 }),
    resinHover: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x65f7ff, emissiveIntensity: 2.15, roughness: 0.1 }),
    reproductive: new THREE.MeshStandardMaterial({ color: 0xf0a66f, emissive: 0x6b2f14, emissiveIntensity: 0.4, roughness: 0.62 }),
    reproductiveHover: new THREE.MeshStandardMaterial({ color: 0xffd0a0, emissive: 0xd4662d, emissiveIntensity: 1.05, roughness: 0.4 })
  };

  const rootMediumMaterial = new THREE.MeshStandardMaterial({
    color: 0x493524,
    roughness: 1,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const rootSurfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b5235,
    roughness: 1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const rootBoundaryMaterial = new THREE.LineBasicMaterial({ color: 0xbfa47a, transparent: true, opacity: 0.38 });

  const rootZone = new THREE.Group();
  rootZone.userData.rootZone = true;
  const mediumShell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.35, 1.9, 56, 6, true, 0.18 * Math.PI, 1.58 * Math.PI),
    rootMediumMaterial
  );
  mediumShell.position.y = -0.98;
  rootZone.add(mediumShell);

  const mediumSurface = new THREE.Mesh(
    new THREE.CircleGeometry(1.54, 64, 0.18 * Math.PI, 1.58 * Math.PI),
    rootSurfaceMaterial
  );
  mediumSurface.rotation.x = -Math.PI / 2;
  mediumSurface.position.y = -0.035;
  rootZone.add(mediumSurface);

  const shellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.56, 1.36, 1.91, 18, 1, true, 0.18 * Math.PI, 1.58 * Math.PI), 28),
    rootBoundaryMaterial
  );
  shellEdges.position.y = -0.98;
  rootZone.add(shellEdges);
  plant.add(rootZone);

  let rootMediumGoalOpacity = 0.16;
  let rootSurfaceGoalOpacity = 0.32;
  let rootBoundaryGoalOpacity = 0.38;

  const semantic = new Map();
  const pickables = [];

  function dimMaterial(material) {
    const dimmed = material.clone();
    dimmed.transparent = true;
    dimmed.opacity = Math.min(material.opacity ?? 1, 0.12);
    if ('depthWrite' in dimmed) dimmed.depthWrite = false;
    if ('emissiveIntensity' in dimmed) dimmed.emissiveIntensity = 0.04;
    return dimmed;
  }

  function tag(group, meta, hoverMaterial) {
    group.userData.meta = meta;
    group.userData.hoverMaterial = hoverMaterial;
    semantic.set(meta.id, group);
    group.traverse((object) => {
      const renderable = object.isMesh || object.isLine || object.isLineSegments;
      if (!renderable || !object.material) return;
      object.userData.semanticGroup = group;
      object.userData.semanticBaseMaterial = object.material;
      object.userData.semanticDimMaterial = dimMaterial(object.material);
      if (object.isMesh) pickables.push(object);
    });
    return group;
  }

  function setVisualState(group, state = 'base') {
    if (!group) return;
    group.traverse((object) => {
      if (!object.userData.semanticBaseMaterial) return;
      if (state === 'highlight' && object.isMesh) object.material = group.userData.hoverMaterial;
      else if (state === 'dim') object.material = object.userData.semanticDimMaterial;
      else object.material = object.userData.semanticBaseMaterial;
    });
  }

  function cylinderBetween(a, b, radius, material, radialSegments = 12) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, direction.length(), radialSegments), material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return mesh;
  }

  function tubeBetween(points, radius, material, tubularSegments = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, 6, false), material);
  }

  function lineFrom(points, material = materials.vein) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.Line(geometry, material);
  }

  function serratedLeafletGeometry(length = 0.96, width = 0.19, teeth = 8) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    const side = [];
    const samples = teeth * 2;
    for (let i = 1; i <= samples; i += 1) {
      const t = i / (samples + 1);
      const envelope = Math.sin(Math.PI * t);
      const tooth = i % 2 === 0 ? 0.7 : 1;
      side.push([width * envelope * tooth, length * t]);
    }
    for (const [x, y] of side) shape.lineTo(x, y);
    shape.lineTo(0, length);
    for (let i = side.length - 1; i >= 0; i -= 1) shape.lineTo(-side[i][0], side[i][1]);
    shape.lineTo(0, 0);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addLeafletVenation(leafletGroup, length, width) {
    const z = 0.008;
    leafletGroup.add(lineFrom([[0, 0.035, z], [0, length * 0.93, z]]));
    [0.2, 0.34, 0.48, 0.62, 0.76].forEach((t, index) => {
      const spread = width * Math.sin(Math.PI * t) * (0.72 - index * 0.045);
      const rise = length * 0.07;
      leafletGroup.add(lineFrom([[0, length * t, z], [spread, length * t + rise, z]]));
      leafletGroup.add(lineFrom([[0, length * t, z], [-spread, length * t + rise, z]]));
    });
  }

  function fanLeaf(position, scale, yaw, pitch = -0.58, roll = 0) {
    const fan = new THREE.Group();
    fan.add(cylinderBetween([0, -0.3, 0], [0, 0.06, 0], 0.018, materials.leaf, 7));
    const angles = [-1.06, -0.69, -0.33, 0, 0.33, 0.69, 1.06];
    angles.forEach((angle, index) => {
      const distance = Math.abs(index - 3);
      const length = 1.02 - distance * 0.07;
      const width = 0.195 - distance * 0.008;
      const leafletGroup = new THREE.Group();
      leafletGroup.add(new THREE.Mesh(serratedLeafletGeometry(length, width, 8), materials.leaf));
      addLeafletVenation(leafletGroup, length, width);
      leafletGroup.rotation.z = angle;
      leafletGroup.rotation.x = distance % 2 ? 0.035 : -0.025;
      leafletGroup.position.y = 0.02;
      fan.add(leafletGroup);
    });
    fan.position.set(...position);
    fan.scale.setScalar(scale);
    fan.rotation.set(pitch, yaw, roll);
    return fan;
  }

  function flowerCluster(position, scale = 1, twist = 0) {
    const cluster = new THREE.Group();
    const bractGeo = new THREE.SphereGeometry(0.16, 12, 9);
    const layers = [
      [0, 0, 0, 1.05], [0.13, 0.14, 0.04, 0.96], [-0.13, 0.15, -0.04, 0.96],
      [0.1, 0.3, -0.05, 0.89], [-0.1, 0.31, 0.05, 0.89], [0, 0.45, 0, 0.83],
      [0.07, 0.55, 0.02, 0.7], [-0.06, 0.56, -0.03, 0.7]
    ];
    layers.forEach(([x, y, z, s], index) => {
      const bract = new THREE.Mesh(bractGeo, materials.flower);
      bract.position.set(x, y, z);
      bract.scale.set(0.72 * s, 1.2 * s, 0.82 * s);
      bract.rotation.z = (index % 2 ? 1 : -1) * 0.18;
      cluster.add(bract);
    });
    for (let i = 0; i < 5; i += 1) {
      const sugarLeaf = new THREE.Mesh(serratedLeafletGeometry(0.43, 0.085, 5), materials.flower);
      sugarLeaf.rotation.z = (i / 5) * Math.PI * 2;
      sugarLeaf.rotation.x = -0.72;
      sugarLeaf.position.set(Math.cos(i * 1.25) * 0.09, 0.26 + (i % 2) * 0.12, Math.sin(i * 1.25) * 0.08);
      sugarLeaf.scale.setScalar(0.78);
      cluster.add(sugarLeaf);
    }
    cluster.position.set(...position);
    cluster.scale.setScalar(scale);
    cluster.rotation.y = twist;
    return cluster;
  }

  function addStigmas(group, position, scale = 1, count = 6) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + 0.25;
      const start = [position[0] + Math.cos(angle) * 0.08 * scale, position[1] + 0.26 * scale, position[2] + Math.sin(angle) * 0.07 * scale];
      const mid = [position[0] + Math.cos(angle) * 0.16 * scale, position[1] + (0.39 + (i % 2) * 0.05) * scale, position[2] + Math.sin(angle) * 0.13 * scale];
      const end = [position[0] + Math.cos(angle) * 0.25 * scale, position[1] + (0.49 + (i % 3) * 0.03) * scale, position[2] + Math.sin(angle) * 0.2 * scale];
      group.add(tubeBetween([start, mid, end], 0.009 * scale, materials.reproductive, 8));
    }
  }

  function addTrichome(group, base, scale = 1) {
    group.add(cylinderBetween(base, [base[0], base[1] + 0.075 * scale, base[2]], 0.008 * scale, materials.resin, 6));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.025 * scale, 8, 6), materials.resin);
    head.position.set(base[0], base[1] + 0.085 * scale, base[2]);
    group.add(head);
  }

  const roots = new THREE.Group();
  const rootSegments = [
    [[0, 0.08, 0], [0, -0.92, 0], 0.078], [[0, -0.26, 0], [-0.54, -0.8, 0.16], 0.052],
    [[0, -0.3, 0], [0.58, -0.82, -0.2], 0.05], [[-0.36, -0.62, 0.12], [-1.05, -1.2, 0.38], 0.032],
    [[0.39, -0.62, -0.15], [1.12, -1.18, -0.42], 0.031], [[0, -0.78, 0], [0.16, -1.55, 0.15], 0.036],
    [[-0.78, -1.02, 0.3], [-1.2, -1.58, 0.08], 0.019], [[0.82, -1.01, -0.34], [1.25, -1.54, -0.07], 0.019],
    [[0.13, -1.31, 0.12], [-0.28, -1.82, 0.29], 0.017], [[-0.54, -0.82, 0.18], [-0.35, -1.43, -0.33], 0.017],
    [[0.59, -0.83, -0.19], [0.42, -1.45, 0.34], 0.017]
  ];
  rootSegments.forEach(([a, b, r]) => roots.add(cylinderBetween(a, b, r, materials.root, 9)));
  const fineRootBases = [
    [-0.78, -1.02, 0.3], [-0.62, -0.93, 0.23], [-0.44, -0.8, 0.16],
    [0.73, -0.96, -0.3], [0.55, -0.82, -0.2], [0.18, -1.36, 0.14], [-0.12, -1.44, 0.2]
  ];
  fineRootBases.forEach((base, i) => {
    for (let j = 0; j < 3; j += 1) {
      const side = i % 2 ? 1 : -1;
      const end = [base[0] + side * (0.28 + j * 0.13), base[1] - 0.23 - j * 0.11, base[2] + (j - 1) * 0.18];
      roots.add(cylinderBetween(base, end, 0.008 + j * 0.0015, materials.root, 6));
    }
  });
  plant.add(tag(roots, {
    id: 'root-system', label: 'Root system', detail: 'Primary, lateral & fine absorbing roots', route: '/atlas/root-system/', focusDistance: 4.25,
    copy: 'Primary and lateral roots branch into fine absorbing roots that anchor the plant, acquire water and ions, respire, and interact with the rhizosphere.'
  }, materials.rootHover));

  const stem = new THREE.Group();
  stem.add(cylinderBetween([0, 0, 0], [0.02, 4.72, 0], 0.087, materials.stem, 14));
  const branchDefs = [
    { origin: [0.01, 1.43, 0], end: [-1.35, 2.02, 0.14] }, { origin: [0.01, 1.5, 0], end: [1.38, 2.08, -0.13] },
    { origin: [0.01, 2.24, 0], end: [-1.22, 2.88, -0.18] }, { origin: [0.01, 2.3, 0], end: [1.24, 2.94, 0.18] },
    { origin: [0.01, 3.0, 0], end: [-0.96, 3.6, 0.15] }, { origin: [0.01, 3.06, 0], end: [0.99, 3.65, -0.15] },
    { origin: [0.01, 3.63, 0], end: [-0.67, 4.12, -0.1] }, { origin: [0.01, 3.7, 0], end: [0.7, 4.18, 0.12] }
  ];
  branchDefs.forEach(({ origin, end }, index) => {
    stem.add(cylinderBetween(origin, end, 0.043 - index * 0.0015, materials.stem, 9));
    const twigStart = [end[0] * 0.72, origin[1] + (end[1] - origin[1]) * 0.72, end[2] * 0.72];
    const twigEnd = [end[0] * 1.05, end[1] + 0.23, end[2] * 1.05];
    stem.add(cylinderBetween(twigStart, twigEnd, 0.024, materials.stem, 7));
  });
  plant.add(tag(stem, {
    id: 'stem-vascular', label: 'Stem & vascular system', detail: 'Main stem, branches, xylem & phloem pathway', route: '/atlas/stem-vascular/', focusDistance: 5.4,
    copy: 'The main stem and branches form a continuous vascular skeleton. Xylem moves water and minerals; phloem redistributes sugars and other assimilates among sources and sinks.'
  }, materials.stemHover));

  const nodes = new THREE.Group();
  [1.43, 2.25, 3.02, 3.65].forEach((y) => {
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 10), materials.node);
    node.position.set(0.01, y, 0);
    node.scale.set(1.25, 0.72, 1.1);
    nodes.add(node);
  });
  plant.add(tag(nodes, {
    id: 'nodes-branching', label: 'Nodes, meristems & branching', detail: 'Axillary sites and branch junctions', route: '/atlas/nodes-branching/', focusDistance: 4.2,
    copy: 'Nodes carry leaves, branches, and axillary meristems. Their spacing and bud activity reveal how growth regulators and environment shape plant architecture.'
  }, materials.nodeHover));

  const leafSpecs = [
    [[-1.22, 1.97, 0.12], 0.79, -1.08, -0.67, -0.08], [[1.26, 2.03, -0.1], 0.79, 1.08, -0.6, 0.08],
    [[-1.08, 2.83, -0.18], 0.7, -1.03, -0.62, -0.06], [[1.1, 2.89, 0.18], 0.7, 1.03, -0.57, 0.06],
    [[-0.86, 3.52, 0.15], 0.61, -0.98, -0.58, -0.05], [[0.89, 3.57, -0.15], 0.61, 0.98, -0.54, 0.05],
    [[-0.56, 4.06, -0.1], 0.49, -0.9, -0.54, -0.04], [[0.58, 4.12, 0.1], 0.49, 0.9, -0.5, 0.04]
  ];
  const leaves = new THREE.Group();
  leafSpecs.forEach(([position, scale, yaw, pitch, roll]) => leaves.add(fanLeaf(position, scale, yaw, pitch, roll)));
  plant.add(tag(leaves, {
    id: 'leaf-module', label: 'Fan leaves', detail: 'Serrated leaflets, petioles, midribs & lateral veins', route: '/atlas/leaf-module/', focusDistance: 4.8,
    copy: 'Serrated leaflets connect through petioles to the vascular system. Midribs and lateral veins distribute water, minerals, sugars, and mechanical support through the blade.'
  }, materials.leafHover));

  const flowerSpecs = [
    [[0.01, 4.56, 0], 1.18, 0], [[-0.9, 3.54, 0.14], 0.76, -0.25], [[0.93, 3.6, -0.14], 0.76, 0.3],
    [[-1.14, 2.84, -0.16], 0.59, -0.45], [[1.16, 2.9, 0.16], 0.59, 0.4]
  ];
  const flowers = new THREE.Group();
  flowerSpecs.forEach(([position, scale, twist]) => flowers.add(flowerCluster(position, scale, twist)));
  plant.add(tag(flowers, {
    id: 'flower-anatomy', label: 'Flowers & inflorescences', detail: 'Bracts, sugar leaves & floral clusters', route: '/atlas/flower-anatomy/', focusDistance: 4.0,
    copy: 'Layered bracts, sugar leaves, stigmas, and dense glandular surfaces form the visible inflorescence. Floral structure changes through pollination and maturation.'
  }, materials.flowerHover));

  const reproductive = new THREE.Group();
  flowerSpecs.forEach(([position, scale]) => addStigmas(reproductive, position, scale, scale > 1 ? 10 : 6));
  [[-0.16, 3.02, 0.04], [0.17, 3.67, -0.03], [-0.15, 2.26, -0.04]].forEach((position) => {
    const preflower = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 9), materials.reproductive);
    preflower.position.set(...position);
    preflower.scale.set(0.62, 1.5, 0.65);
    reproductive.add(preflower);
  });
  plant.add(tag(reproductive, {
    id: 'reproductive-biology', label: 'Reproductive structures', detail: 'Stigmas, preflowers & pollen-reception surfaces', route: '/atlas/reproductive-biology/', focusDistance: 4.15,
    copy: 'Stigmas and preflowers connect visible floral anatomy to sex expression, pollen reception, fertilization, embryo development, and seed formation.'
  }, materials.reproductiveHover));

  const resin = new THREE.Group();
  flowerSpecs.forEach(([position, scale], flowerIndex) => {
    const count = flowerIndex === 0 ? 28 : 10;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + flowerIndex * 0.4;
      const layer = i % 5;
      const radius = (0.12 + layer * 0.025) * scale;
      const base = [position[0] + Math.cos(angle) * radius, position[1] + (0.12 + layer * 0.085) * scale, position[2] + Math.sin(angle) * radius];
      addTrichome(resin, base, Math.max(0.62, scale * 0.8));
    }
  });
  plant.add(tag(resin, {
    id: 'trichomes-resin', label: 'Glandular trichomes', detail: 'Stalks and secretory gland heads', route: '/atlas/trichomes-resin/', focusDistance: 3.65,
    copy: 'Each modeled gland has a stalk and gland head. Real glandular trichomes differ by form, tissue location, developmental stage, and secretory activity.'
  }, materials.resinHover));

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 0.08 };
  const pointer = new THREE.Vector2(2, 2);
  let hovered = null;
  let selected = null;
  let pointerDown = null;
  let cameraGoal = null;
  let targetGoal = null;

  function refreshVisuals() {
    for (const group of semantic.values()) {
      if (group === selected || (!selected && group === hovered) || (selected && group === hovered)) setVisualState(group, 'highlight');
      else if (selected) setVisualState(group, 'dim');
      else setVisualState(group, 'base');
    }
  }

  function updateInspectionState(group) {
    const id = group?.userData?.meta?.id || 'whole';
    host.dataset.plantInspection = id;
    host.dataset.isolation = group ? 'active' : 'off';
    const rootsActive = id === 'root-system';
    host.dataset.rootCutaway = rootsActive ? 'active' : 'resting';
    const inspectingOther = Boolean(group) && !rootsActive;
    rootMediumGoalOpacity = rootsActive ? 0.055 : inspectingOther ? 0.035 : 0.16;
    rootSurfaceGoalOpacity = rootsActive ? 0.11 : inspectingOther ? 0.06 : 0.32;
    rootBoundaryGoalOpacity = rootsActive ? 0.62 : inspectingOther ? 0.1 : 0.38;
  }

  function describe(group, mode = 'hover') {
    const meta = group?.userData?.meta;
    if (!meta) return;
    if (tooltip) {
      tooltip.innerHTML = `<strong>${meta.label}</strong><span>${mode === 'hover' ? 'Click to open this Atlas module' : 'Selected structure · isolated for inspection'}</span>`;
      tooltip.hidden = false;
    }
    if (inspector) {
      inspectorKicker.textContent = mode === 'hover' ? '3D plant structure' : 'Selected structure';
      inspectorTitle.textContent = meta.label;
      inspectorCopy.textContent = meta.copy;
      inspectorLink.href = meta.route;
      inspectorLink.textContent = `Open ${meta.label} →`;
      inspector.classList.add('active');
    }
    if (mode === 'selected') {
      anatomyLabel.innerHTML = `<strong>${meta.label}</strong><br><span style="font-weight:600;color:#b8d8c4">${meta.detail || 'Living plant anatomy'}</span>`;
      anatomyLabel.hidden = false;
    }
  }

  function updateAnatomyLabel() {
    if (!selected) return;
    const box = new THREE.Box3().setFromObject(selected);
    const anchor = box.getCenter(new THREE.Vector3());
    anchor.y = box.max.y + Math.max(0.08, (box.max.y - box.min.y) * 0.08);
    anchor.project(camera);
    if (anchor.z < -1 || anchor.z > 1) {
      anatomyLabel.hidden = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const x = rect.left - hostRect.left + (anchor.x * 0.5 + 0.5) * rect.width;
    const y = rect.top - hostRect.top + (-anchor.y * 0.5 + 0.5) * rect.height;
    anatomyLabel.style.left = `${x}px`;
    anatomyLabel.style.top = `${y}px`;
    anatomyLabel.hidden = false;
  }

  function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function hitTest(event) {
    pointerToCanvas(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false).find((entry) => entry.object.userData.semanticGroup);
    return hit?.object.userData.semanticGroup || null;
  }

  function clearHover() {
    hovered = null;
    refreshVisuals();
    if (tooltip) tooltip.hidden = true;
    canvas.style.cursor = 'grab';
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
    refreshVisuals();
    updateInspectionState(group);
    describe(group, 'selected');

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    const preferred = group.userData.meta?.focusDistance;
    const distance = THREE.MathUtils.clamp(preferred || Math.max(3.3, sphere.radius * 4.2), 3.25, 6.8);
    cameraGoal = center.clone().add(viewDirection.multiplyScalar(distance));
    targetGoal = center;
    if (id === 'root-system') {
      cameraGoal.y = Math.max(0.35, center.y + 2.1);
      cameraGoal.z += 0.45;
    }
    if (reducedMotion) {
      camera.position.copy(cameraGoal);
      controls.target.copy(targetGoal);
      cameraGoal = null;
      targetGoal = null;
    }
  }

  function resetView() {
    controls.autoRotate = !reducedMotion;
    selected = null;
    hovered = null;
    refreshVisuals();
    updateInspectionState(null);
    focusButtons.forEach((item) => item.classList.remove('active'));
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
    refreshVisuals();
    if (hovered) {
      describe(hovered, selected === hovered ? 'selected' : 'hover');
      canvas.style.cursor = 'pointer';
    } else {
      if (tooltip) tooltip.hidden = true;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('pointerleave', clearHover);

  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 7) return;
    const group = hitTest(event);
    if (!group) return;
    selected = group;
    hovered = group;
    refreshVisuals();
    updateInspectionState(group);
    describe(group, 'selected');
    const route = group.userData.meta?.route;
    if (route) window.location.assign(route);
  });

  focusButtons.forEach((button) => button.addEventListener('click', () => {
    controls.autoRotate = false;
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
      if (camera.position.distanceTo(cameraGoal) < 0.025 && controls.target.distanceTo(targetGoal) < 0.02) {
        cameraGoal = null;
        targetGoal = null;
      }
    }
    rootMediumMaterial.opacity += (rootMediumGoalOpacity - rootMediumMaterial.opacity) * 0.09;
    rootSurfaceMaterial.opacity += (rootSurfaceGoalOpacity - rootSurfaceMaterial.opacity) * 0.09;
    rootBoundaryMaterial.opacity += (rootBoundaryGoalOpacity - rootBoundaryMaterial.opacity) * 0.09;
    controls.update();
    updateAnatomyLabel();
    renderer.render(scene, camera);
  });

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    visibility.disconnect();
    controls.dispose();
    anatomyLabel.remove();
    renderer.dispose();
  }, { once: true });
}
