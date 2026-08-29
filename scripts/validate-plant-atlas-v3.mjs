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

const mirrored = ['index.html', 'atlas-v3.css', 'atlas-v3.js', 'module.js', 'data/systems.json', 'deploy-version.txt'];
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
for (const marker of ['16 connected systems', 'Structure → function → observation', 'Observation rule:', '/atlas/leaf-module/', '/atlas/root-system/']) {
  if (!hub.includes(marker)) fail(`Atlas hub missing release marker: ${marker}`);
}
if (/href=["']\/learn\/["']/.test(JSON.stringify(data.systems))) fail('Core Atlas system data must not fall back to generic /learn/ routes.');

const packageScript = fs.readFileSync(path.join(repo, 'scripts/package-public-suite-wordpress.py'), 'utf8');
if (!packageScript.includes('"atlas",') || !packageScript.includes('"assets/images/atlas",')) fail('Public-suite package does not allowlist Atlas.');

console.log(JSON.stringify({ ok: true, schemaVersion: data.schemaVersion, systems: data.systems.length, routes: routes.size, mirroredFiles: mirrored.length, deepPages: deepPages.length }));
