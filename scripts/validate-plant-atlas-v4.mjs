#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appRoot = path.join(root, 'apps/growlens-web/public/atlas');
const mirrorRoot = path.join(root, 'site/public-route-patch/atlas');

const requiredMirrors = [
  'atlas-3d-v4.js',
  'data/hotspots-v4.json',
  'models/README.md',
];

const errors = [];
const ok = (condition, message) => {
  if (!condition) errors.push(message);
};

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    errors.push(`Cannot read ${path.relative(root, file)}: ${error.message}`);
    return '';
  }
}

for (const relative of requiredMirrors) {
  const source = path.join(appRoot, relative);
  const mirror = path.join(mirrorRoot, relative);
  ok(fs.existsSync(source), `Missing source file: ${path.relative(root, source)}`);
  ok(fs.existsSync(mirror), `Missing public-route mirror: ${path.relative(root, mirror)}`);
  if (fs.existsSync(source) && fs.existsSync(mirror)) {
    ok(fs.readFileSync(source).equals(fs.readFileSync(mirror)), `Mirror mismatch: ${relative}`);
  }
}

const renderer = read(path.join(appRoot, 'atlas-3d-v4.js'));
const rendererTokens = [
  "GLTFLoader",
  "RoomEnvironment",
  "const MODEL_URL = '/atlas/models/cannabis-specimen-v1.glb'",
  "loader.loadAsync(MODEL_URL)",
  "new THREE.Raycaster()",
  "new OrbitControls(camera, canvas)",
  "canvas.addEventListener('pointerup'",
  "export async function bootPhotorealAtlas()",
  "host.dataset.modelMode = 'photoreal-glb'",
  "host.dataset.plantInspection",
  "host.dataset.rootCutaway",
  "host.dataset.isolation",
  "renderer.toneMapping = THREE.ACESFilmicToneMapping",
];
for (const token of rendererTokens) ok(renderer.includes(token), `V4 renderer contract missing: ${token}`);

let hotspotData = null;
try {
  hotspotData = JSON.parse(read(path.join(appRoot, 'data/hotspots-v4.json')));
} catch (error) {
  errors.push(`Invalid hotspots-v4.json: ${error.message}`);
}

if (hotspotData) {
  ok(hotspotData.schemaVersion === 4, 'hotspots-v4.json must use schemaVersion 4');
  ok(hotspotData.model === '/atlas/models/cannabis-specimen-v1.glb', 'hotspot model path must match the V4 renderer');
  ok(hotspotData.coordinateSpace === 'normalized-model-bounds', 'hotspot coordinate space must be normalized-model-bounds');

  const required = new Map([
    ['root-system', '/atlas/root-system/'],
    ['stem-vascular', '/atlas/stem-vascular/'],
    ['nodes-branching', '/atlas/nodes-branching/'],
    ['leaf-module', '/atlas/leaf-module/'],
    ['flower-anatomy', '/atlas/flower-anatomy/'],
    ['trichomes-resin', '/atlas/trichomes-resin/'],
    ['reproductive-biology', '/atlas/reproductive-biology/'],
  ]);
  const hotspots = Array.isArray(hotspotData.hotspots) ? hotspotData.hotspots : [];
  ok(hotspots.length >= required.size, `Expected at least ${required.size} anatomy hotspots`);
  const ids = new Set();
  for (const hotspot of hotspots) {
    ok(typeof hotspot?.id === 'string' && hotspot.id.length > 0, 'Every hotspot needs an id');
    ok(!ids.has(hotspot?.id), `Duplicate hotspot id: ${hotspot?.id}`);
    ids.add(hotspot?.id);
    ok(typeof hotspot?.label === 'string' && hotspot.label.length > 0, `Hotspot ${hotspot?.id || '(unknown)'} needs a label`);
    ok(typeof hotspot?.copy === 'string' && hotspot.copy.length > 40, `Hotspot ${hotspot?.id || '(unknown)'} needs explanatory copy`);
    ok(Array.isArray(hotspot?.anchors) && hotspot.anchors.length > 0, `Hotspot ${hotspot?.id || '(unknown)'} needs at least one anchor`);
    for (const anchor of hotspot?.anchors || []) {
      ok(Array.isArray(anchor) && anchor.length === 3, `Hotspot ${hotspot?.id || '(unknown)'} has an invalid 3D anchor`);
      for (const value of anchor || []) ok(Number.isFinite(value) && value >= 0 && value <= 1, `Hotspot ${hotspot?.id || '(unknown)'} anchor coordinates must be between 0 and 1`);
    }
  }
  for (const [id, route] of required) {
    const hotspot = hotspots.find((entry) => entry.id === id);
    ok(Boolean(hotspot), `Missing required hotspot: ${id}`);
    if (hotspot) ok(hotspot.route === route, `Hotspot ${id} must retain route ${route}`);
  }
}

const modelReadme = read(path.join(appRoot, 'models/README.md'));
for (const token of ['cannabis-specimen-v1.glb', 'glTF 2.0', 'exposed root system', '80k–250k', 'mid-range Android phone']) {
  ok(modelReadme.includes(token), `Model contract missing release requirement: ${token}`);
}

// The production GLB is deliberately not required here. V4 must stay reviewable and
// fall back to V3 until a licensed, botanically approved model has been committed.
const modelPath = path.join(appRoot, 'models/cannabis-specimen-v1.glb');
if (fs.existsSync(modelPath)) {
  const bytes = fs.statSync(modelPath).size;
  ok(bytes > 1024, 'Production GLB exists but is suspiciously small');
  console.log(`Plant Atlas V4 model present: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.log('Plant Atlas V4 model not yet committed; V3 fallback remains the release-safe path.');
}

if (errors.length) {
  console.error(`Plant Atlas V4 validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Plant Atlas V4 renderer architecture, hotspot map, and deployment mirror are valid.');
