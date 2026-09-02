#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const roots = [
  path.join(repo, 'apps/growlens-web/public/atlas'),
  path.join(repo, 'site/public-route-patch/atlas'),
];
const fail = (message) => { throw new Error(message); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// This validator protects the schema-v3 educational system and the legacy V3 renderer
// retained as an emergency fallback. The active hub is V4-first and is validated by
// validate-plant-atlas-v4.mjs.
const mirrored = ['index.html', 'atlas-v3.css', 'atlas-v3.js', 'atlas-3d.js', 'module.js', 'data/systems.json', 'deploy-version.txt'];
for (const rel of mirrored) {
  const [a, b] = roots.map((root) => read(root, rel));
  if (a !== b) fail(`Atlas mirror drift: ${rel}`);
}

const data = JSON.parse(read(roots[0], 'data/systems.json'));
if (data.schemaVersion !== 3) fail(`Expected Atlas schemaVersion 3, got ${data.schemaVersion}`);
if (!Array.isArray(data.systems) || data.systems.length !== 16) fail(`Expected 16 Atlas systems, got ${data.systems?.length}`);

const ids = new Set();
const routes = new Set();
const categories = new Set(['Development', 'Anatomy', 'Physiology', 'Reproduction', 'Genetics', 'Environment', 'Diagnostics']);
for (const system of data.systems) {
  if (!system.id || ids.has(system.id)) fail(`Duplicate or missing Atlas id: ${system.id}`);
  ids.add(system.id);
  if (!system.route?.startsWith('/atlas/') || !system.route.endsWith('/')) fail(`Invalid Atlas route for ${system.id}: ${system.route}`);
  if (routes.has(system.route)) fail(`Duplicate Atlas route: ${system.route}`);
  routes.add(system.route);
  if (!categories.has(system.category)) fail(`Unexpected Atlas category for ${system.id}: ${system.category}`);
  for (const field of ['summary', 'visual']) if (!String(system[field] || '').trim()) fail(`${system.id} missing ${field}`);
  for (const field of ['concepts', 'functions', 'observe', 'interactions', 'cautions', 'related', 'searchTerms']) {
    if (!Array.isArray(system[field]) || system[field].length < 2) fail(`${system.id} has incomplete ${field}`);
  }
}

for (const system of data.systems) {
  for (const related of system.related) if (!ids.has(related)) fail(`${system.id} references unknown related system ${related}`);
  const routeRel = `${system.route.replace(/^\/atlas\//, '')}index.html`;
  for (const root of roots) {
    const routeFile = path.join(root, routeRel);
    if (!fs.existsSync(routeFile) || fs.statSync(routeFile).size === 0) fail(`Missing Atlas route file: ${routeFile}`);
  }
}

const deepPages = [
  'leaf-module/leaf-anatomy/index.html',
  'leaf-module/stomata/index.html',
  'leaf-module/photosynthesis/index.html',
  'leaf-module/transpiration/index.html',
  'leaf-module/chlorosis/index.html',
  'leaf-module/necrosis/index.html',
  'root-system/root-anatomy/index.html',
  'root-system/rhizosphere/index.html',
  'root-system/water-uptake/index.html',
  'root-system/nutrient-uptake/index.html',
  'root-system/root-oxygen/index.html',
  'root-system/root-zone-diagnostics/index.html',
];
for (const rel of deepPages) for (const root of roots) if (!fs.existsSync(path.join(root, rel))) fail(`Missing deep Atlas page: ${root}/${rel}`);

const hub = read(roots[0], 'index.html');
for (const marker of ['Interactive botanical specimen', '3D anatomy explorer', 'Learn from the plant itself', 'Structure → function → interaction → evidence', 'Observation rule:', '/atlas/atlas-3d-bootstrap.js', '/atlas/leaf-module/', '/atlas/root-system/']) {
  if (!hub.includes(marker)) fail(`Atlas hub missing release marker: ${marker}`);
}
for (const id of ['root-system', 'stem-vascular', 'nodes-branching', 'leaf-module', 'flower-anatomy', 'trichomes-resin', 'reproductive-biology']) {
  if (!hub.includes(`data-plant-focus="${id}"`)) fail(`Atlas hub missing 3D focus control: ${id}`);
}
if (!hub.includes('three@0.180.0') || !hub.includes('three/addons/')) fail('Atlas hub is missing pinned Three.js import map.');
if (hub.includes('type="module" src="/atlas/atlas-3d.js"')) fail('Legacy V3 renderer must not boot directly from the Atlas hub.');

const fallbackScene = read(roots[0], 'atlas-3d.js');
for (const marker of ['new THREE.WebGLRenderer', 'new THREE.Raycaster', 'new OrbitControls', 'pointermove', 'pointerup', 'window.location.assign', 'prefers-reduced-motion', 'IntersectionObserver']) {
  if (!fallbackScene.includes(marker)) fail(`Atlas V3 emergency renderer missing interaction/performance contract: ${marker}`);
}
for (const route of ['/atlas/root-system/', '/atlas/stem-vascular/', '/atlas/nodes-branching/', '/atlas/leaf-module/', '/atlas/flower-anatomy/', '/atlas/trichomes-resin/', '/atlas/reproductive-biology/']) {
  if (!fallbackScene.includes(route)) fail(`Atlas V3 emergency renderer missing direct anatomy route: ${route}`);
}

const bootstrap = read(roots[0], 'atlas-3d-bootstrap.js');
if (!bootstrap.includes("import('/atlas/atlas-3d-v4.js')") || !bootstrap.includes("import('/atlas/atlas-3d.js')")) fail('Atlas bootstrap must prefer V4 and retain V3 as emergency fallback.');
if (/href=["']\/learn\/["']/.test(JSON.stringify(data.systems))) fail('Core Atlas system data must not fall back to generic /learn/ routes.');

const packageScript = fs.readFileSync(path.join(repo, 'scripts/package-public-suite-wordpress.py'), 'utf8');
if (!packageScript.includes('"atlas",') || !packageScript.includes('"assets/images/atlas",')) fail('Public-suite package does not allowlist Atlas.');
for (const runtime of ['"atlas/atlas-3d-bootstrap.js",', '"atlas/atlas-3d-v4.js",', '"atlas/atlas-v4.css",', '"atlas/data/hotspots-v4.json",', '"atlas/models/model-manifest-v4.json",']) {
  if (!packageScript.includes(runtime)) fail(`Public-suite package does not require V4 runtime asset: ${runtime}`);
}

console.log(JSON.stringify({ ok: true, schemaVersion: data.schemaVersion, systems: data.systems.length, routes: routes.size, mirroredFiles: mirrored.length, deepPages: deepPages.length, activeRenderer: 'v4', emergencyFallback: 'v3' }));