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

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.35 : 1.75));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07151b, 0.035);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(5.5, 3.8, 7.9);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 4.4;
  controls.maxDistance = 11.5;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.62;
  controls.target.set(0, 2.1, 0);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.38;

  scene.add(new THREE.HemisphereLight(0xbdefff, 0x17351f, 2.0));
  const key = new THREE.DirectionalLight(0xf1ffe7, 3.4); key.position.set(4, 8, 5); scene.add(key);
  const rim = new THREE.PointLight(0x46dfff, 18, 18, 2); rim.position.set(-5, 4.5, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xf1bc61, 10, 12, 2); warm.position.set(4, 2.5, 2); scene.add(warm);

  const plant = new THREE.Group(); plant.rotation.y = -0.24; scene.add(plant);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), new THREE.MeshStandardMaterial({ color: 0x06191e, roughness: 1, transparent: true, opacity: 0.85 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; scene.add(ground);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.28, 96), new THREE.MeshBasicMaterial({ color: 0x2ca7c0, transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.045; scene.add(ring);

  const materials = {
    stem: new THREE.MeshStandardMaterial({ color: 0x5d8f50, roughness: 0.72 }),
    stemHover: new THREE.MeshStandardMaterial({ color: 0xa8e47e, emissive: 0x214417, emissiveIntensity: 0.8, roughness: 0.55 }),
    root: new THREE.MeshStandardMaterial({ color: 0xd6c7a6, roughness: 0.9 }),
    rootHover: new THREE.MeshStandardMaterial({ color: 0xffe5aa, emissive: 0x4d3514, emissiveIntensity: 0.8, roughness: 0.7 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3e8e4e, roughness: 0.7, side: THREE.DoubleSide }),
    leafHover: new THREE.MeshStandardMaterial({ color: 0x78d96f, emissive: 0x164d1b, emissiveIntensity: 1, roughness: 0.55, side: THREE.DoubleSide }),
    flower: new THREE.MeshStandardMaterial({ color: 0x79a85a, roughness: 0.82 }),
    flowerHover: new THREE.MeshStandardMaterial({ color: 0xb9dd79, emissive: 0x41551c, emissiveIntensity: 0.9, roughness: 0.65 }),
    node: new THREE.MeshStandardMaterial({ color: 0x9aca70, roughness: 0.55 }),
    nodeHover: new THREE.MeshStandardMaterial({ color: 0xe3ff9a, emissive: 0x48651d, emissiveIntensity: 0.9, roughness: 0.45 }),
    resin: new THREE.MeshStandardMaterial({ color: 0xd7f4df, emissive: 0x5ee7df, emissiveIntensity: 1.3, roughness: 0.25 }),
    resinHover: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x63f6ff, emissiveIntensity: 2.2, roughness: 0.12 }),
    reproductive: new THREE.MeshStandardMaterial({ color: 0xf1b06c, emissive: 0x6e3212, emissiveIntensity: 0.4, roughness: 0.65 }),
    reproductiveHover: new THREE.MeshStandardMaterial({ color: 0xffd199, emissive: 0xcf6b2d, emissiveIntensity: 1, roughness: 0.45 })
  };

  const semantic = new Map();
  const pickables = [];
  function tag(group, meta, baseMaterial, hoverMaterial) {
    group.userData.meta = meta; group.userData.baseMaterial = baseMaterial; group.userData.hoverMaterial = hoverMaterial; semantic.set(meta.id, group);
    group.traverse((object) => { if (object.isMesh) { object.userData.semanticGroup = group; pickables.push(object); } });
    return group;
  }
  function cylinderBetween(a, b, radius, material, radialSegments = 12) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, direction.length(), radialSegments), material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return mesh;
  }
  function leafGeometry(length = 0.92, width = 0.23) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(width * 0.75, length * 0.22, width, length * 0.6, 0, length); shape.bezierCurveTo(-width, length * 0.6, -width * 0.75, length * 0.22, 0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 10); geometry.translate(0, -length * 0.06, 0); return geometry;
  }
  function fanLeaf(position, scale, yaw, pitch = -0.55) {
    const fan = new THREE.Group();
    [-1.02, -0.62, -0.28, 0, 0.28, 0.62, 1.02].forEach((angle, index) => {
      const leaflet = new THREE.Mesh(leafGeometry(0.95 - Math.abs(index - 3) * 0.055, 0.19), materials.leaf); leaflet.rotation.z = angle; leaflet.position.y = -0.03; fan.add(leaflet);
    });
    fan.position.set(...position); fan.scale.setScalar(scale); fan.rotation.set(pitch, yaw, 0); return fan;
  }
  function flowerCluster(position, scale = 1) {
    const cluster = new THREE.Group(), geo = new THREE.IcosahedronGeometry(0.22, 1);
    [[0,0,0],[0.13,0.18,0.03],[-0.13,0.16,-0.03],[0.07,0.34,-0.04],[-0.08,0.32,0.06],[0,0.48,0]].forEach(([x,y,z], i) => {
      const bud = new THREE.Mesh(geo, materials.flower); bud.position.set(x,y,z); bud.scale.set(1 - i * 0.04, 1.25, 0.95); cluster.add(bud);
    });
    cluster.position.set(...position); cluster.scale.setScalar(scale); return cluster;
  }

  const roots = new THREE.Group();
  [[[0,0.08,0],[0,-0.9,0],0.075],[[0,-0.35,0],[-0.72,-1.12,0.22],0.046],[[0,-0.42,0],[0.74,-1.08,-0.25],0.043],[[-0.32,-0.72,0.11],[-1.13,-1.35,0.4],0.026],[[0.35,-0.68,-0.12],[1.18,-1.31,-0.42],0.025],[[0,-0.78,0],[0.16,-1.58,0.16],0.033],[[-0.63,-1.02,0.22],[-0.91,-1.55,-0.12],0.018],[[0.69,-1,-0.24],[0.95,-1.52,0.12],0.018],[[0.13,-1.34,0.13],[-0.24,-1.8,0.26],0.016]].forEach(([a,b,r]) => roots.add(cylinderBetween(a,b,r,materials.root,10)));
  plant.add(tag(roots,{ id:'root-system', label:'Root system', route:'/atlas/root-system/', copy:'Anchorage, water and mineral uptake, oxygen-demanding respiration, and rhizosphere exchange begin here.' },materials.root,materials.rootHover));

  const stem = new THREE.Group(); stem.add(cylinderBetween([0,0,0],[0.02,4.7,0],0.085,materials.stem,14));
  plant.add(tag(stem,{ id:'stem-vascular', label:'Stem & vascular system', route:'/atlas/stem-vascular/', copy:'The stem supports the canopy while xylem and phloem connect roots, leaves, meristems, and flowers.' },materials.stem,materials.stemHover));

  const branchDefs = [{y:1.45,end:[-1.28,2,0.12]},{y:1.5,end:[1.34,2.05,-0.12]},{y:2.25,end:[-1.18,2.85,-0.18]},{y:2.3,end:[1.2,2.9,0.18]},{y:3,end:[-0.92,3.55,0.15]},{y:3.05,end:[0.95,3.6,-0.15]},{y:3.62,end:[-0.64,4.06,-0.1]},{y:3.68,end:[0.66,4.12,0.12]}];
  const branches = new THREE.Group(); branchDefs.forEach(({y,end}) => branches.add(cylinderBetween([0.01,y,0],end,0.042,materials.stem,10))); plant.add(branches);

  const nodes = new THREE.Group(); [1.45,2.27,3.03,3.65].forEach((y) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.13,18,12),materials.node); n.position.set(0.01,y,0); nodes.add(n); });
  plant.add(tag(nodes,{ id:'nodes-branching', label:'Nodes, meristems & branching', route:'/atlas/nodes-branching/', copy:'Nodes anchor leaves and axillary buds. Meristems generate new tissues and determine branching architecture.' },materials.node,materials.nodeHover));

  const leaves = new THREE.Group();
  [[[-1.18,1.98,0.1],0.78,-1.1],[[1.22,2.02,-0.1],0.78,1.1],[[-1.05,2.82,-0.18],0.68,-1.05],[[1.07,2.87,0.18],0.68,1.05],[[-0.83,3.5,0.15],0.58,-1],[[0.86,3.55,-0.15],0.58,1],[[-0.54,4.02,-0.1],0.46,-0.92],[[0.56,4.08,0.1],0.46,0.92]].forEach(([position,scale,yaw],i) => leaves.add(fanLeaf(position,scale,yaw,-0.68 + (i % 2) * 0.12)));
  plant.add(tag(leaves,{ id:'leaf-module', label:'Fan leaves', route:'/atlas/leaf-module/', copy:'Leaves capture light, fix carbon, regulate gas exchange, and drive much of the transpiration stream.' },materials.leaf,materials.leafHover));

  const flowers = new THREE.Group(); [[[0.01,4.62,0],1.18],[[-0.88,3.52,0.14],0.75],[[0.91,3.58,-0.14],0.75],[[-1.12,2.82,-0.16],0.58],[[1.14,2.88,0.16],0.58]].forEach(([position,scale]) => flowers.add(flowerCluster(position,scale)));
  plant.add(tag(flowers,{ id:'flower-anatomy', label:'Flowers & inflorescences', route:'/atlas/flower-anatomy/', copy:'Reproductive structures include bracts, stigmas, anthers, floral meristems, and dense glandular surfaces.' },materials.flower,materials.flowerHover));

  const reproductive = new THREE.Group(); [[-0.18,3.05,0.05],[0.19,3.66,-0.03],[-0.16,2.28,-0.05]].forEach((p) => { const preflower = new THREE.Mesh(new THREE.SphereGeometry(0.085,16,10),materials.reproductive); preflower.position.set(...p); preflower.scale.set(0.7,1.55,0.7); reproductive.add(preflower); });
  plant.add(tag(reproductive,{ id:'reproductive-biology', label:'Reproductive sites', route:'/atlas/reproductive-biology/', copy:'Preflowers and floral organs reveal sex expression, pollen biology, fertilization, and seed-development pathways.' },materials.reproductive,materials.reproductiveHover));

  const resin = new THREE.Group(), resinGeo = new THREE.SphereGeometry(0.026,10,8);
  for (let i=0;i<38;i+=1) { const point = new THREE.Mesh(resinGeo,materials.resin), theta=(i/38)*Math.PI*2, band=i%7, radius=0.2+(band%3)*0.045; point.position.set(Math.cos(theta)*radius,4.88+(band-3)*0.07,Math.sin(theta)*radius); resin.add(point); }
  plant.add(tag(resin,{ id:'trichomes-resin', label:'Trichomes & resin glands', route:'/atlas/trichomes-resin/', copy:'Glandular trichomes are specialized epidermal structures with stalks, secretory cells, gland heads, and stored metabolites.' },materials.resin,materials.resinHover));

  branches.traverse((object) => { if (object.isMesh) { object.userData.semanticGroup = stem; pickables.push(object); } });

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(2,2);
  let hovered = null, selected = null, pointerDown = null;
  function setGroupMaterial(group, material) { group.traverse((object) => { if (object.isMesh && object.material !== material) object.material = material; }); }
  function restore(group) { if (group) setGroupMaterial(group, selected === group ? group.userData.hoverMaterial : group.userData.baseMaterial); }
  function describe(group, mode='hover') {
    const meta = group?.userData?.meta; if (!meta) return;
    if (tooltip) { tooltip.innerHTML = `<strong>${meta.label}</strong><span>${mode === 'hover' ? 'Click to open this Atlas module' : 'Selected anatomy'}</span>`; tooltip.hidden = false; }
    if (inspector) { inspectorKicker.textContent = mode === 'hover' ? '3D structure' : 'Selected structure'; inspectorTitle.textContent = meta.label; inspectorCopy.textContent = meta.copy; inspectorLink.href = meta.route; inspectorLink.textContent = `Open ${meta.label} →`; inspector.classList.add('active'); }
  }
  function clearHover() { if (hovered) restore(hovered); hovered = null; if (tooltip) tooltip.hidden = true; canvas.style.cursor = 'grab'; }
  function pointerToCanvas(event) { const rect = canvas.getBoundingClientRect(); pointer.x=((event.clientX-rect.left)/rect.width)*2-1; pointer.y=-((event.clientY-rect.top)/rect.height)*2+1; }
  function hitTest(event) { pointerToCanvas(event); raycaster.setFromCamera(pointer,camera); return raycaster.intersectObjects(pickables,false).find((hit)=>hit.object.userData.semanticGroup)?.object.userData.semanticGroup || null; }

  canvas.addEventListener('pointerdown',(event)=>{ pointerDown={x:event.clientX,y:event.clientY}; controls.autoRotate=false; });
  canvas.addEventListener('pointermove',(event)=>{ if(isTouch)return; const next=hitTest(event); if(next===hovered)return; if(hovered)restore(hovered); hovered=next; if(hovered){setGroupMaterial(hovered,hovered.userData.hoverMaterial);describe(hovered,'hover');canvas.style.cursor='pointer';}else{if(tooltip)tooltip.hidden=true;canvas.style.cursor='grab';} });
  canvas.addEventListener('pointerleave',clearHover);
  canvas.addEventListener('pointerup',(event)=>{ if(!pointerDown)return; const moved=Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y); pointerDown=null; if(moved>7)return; const group=hitTest(event); if(!group)return; if(selected&&selected!==group)restore(selected); selected=group; setGroupMaterial(selected,selected.userData.hoverMaterial); describe(selected,'selected'); if(selected.userData.meta.route)window.location.assign(selected.userData.meta.route); });

  function focusSystem(id){ const group=semantic.get(id); if(!group)return; if(selected&&selected!==group)restore(selected); selected=group;setGroupMaterial(group,group.userData.hoverMaterial);describe(group,'selected');const center=new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());controls.target.lerp(center,reducedMotion?1:0.72); }
  focusButtons.forEach((button)=>button.addEventListener('click',()=>{controls.autoRotate=false;focusSystem(button.dataset.plantFocus);focusButtons.forEach((item)=>item.classList.toggle('active',item===button));}));
  resetButton?.addEventListener('click',()=>{controls.autoRotate=!reducedMotion;camera.position.set(5.5,3.8,7.9);controls.target.set(0,2.1,0);if(selected)restore(selected);selected=null;focusButtons.forEach((item)=>item.classList.remove('active'));inspector?.classList.remove('active');});

  function resize(){ const rect=host.getBoundingClientRect(), width=Math.max(1,rect.width), height=Math.max(420,rect.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix(); }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let active=true;const visibility=new IntersectionObserver(([entry])=>{active=Boolean(entry?.isIntersecting);},{rootMargin:'180px'});visibility.observe(host);
  renderer.setAnimationLoop(()=>{if(!active)return;controls.update();resin.rotation.y+=reducedMotion?0:0.0014;renderer.render(scene,camera);});
  window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);observer.disconnect();visibility.disconnect();controls.dispose();renderer.dispose();},{once:true});
}
