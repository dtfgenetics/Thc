#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'apps/growlens-web/public/terpene-atlas');
const mirrorRoot = path.join(root, 'site/public-route-patch/terpene-atlas');
const dataRoot = path.join(sourceRoot, 'data');
const errors = [];

const requiredFiles = [
  'index.html',
  'terpene-atlas-v1.css',
  'terpene-atlas-v1.js',
  'data/terpene-schema-v1.json',
  'data/sources-v1.json',
  'data/terpene-catalog-v1.json',
  'data/sample-profile-schema-v1.json',
];

for (const relative of requiredFiles) {
  const source = path.join(sourceRoot, relative);
  const mirror = path.join(mirrorRoot, relative);
  if (!fs.existsSync(source)) errors.push(`Missing Terpene Atlas source file: ${relative}`);
  if (!fs.existsSync(mirror)) errors.push(`Missing Terpene Atlas public mirror: ${relative}`);
  if (fs.existsSync(source) && fs.existsSync(mirror) && !fs.readFileSync(source).equals(fs.readFileSync(mirror))) {
    errors.push(`Terpene Atlas mirror mismatch: ${relative}`);
  }
}

const readJSON = (name) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataRoot, name), 'utf8')); }
  catch (error) { errors.push(`${name}: ${error.message}`); return null; }
};

const sources = readJSON('sources-v1.json');
const catalog = readJSON('terpene-catalog-v1.json');
const sampleSchema = readJSON('sample-profile-schema-v1.json');
const schema = readJSON('terpene-schema-v1.json');

if (schema?.schemaVersion !== 1) errors.push('terpene-schema-v1.json must use schemaVersion 1');
if (catalog?.schemaVersion !== 1) errors.push('terpene-catalog-v1.json must use schemaVersion 1');
if (sampleSchema?.schemaVersion !== 1) errors.push('sample-profile-schema-v1.json must use schemaVersion 1');

const sourceIds = new Set((sources?.sources || []).map((s) => s.id));
if (sourceIds.size < 3) errors.push('Terpene Atlas source registry is unexpectedly small');

const seen = new Set();
for (const item of catalog?.compounds || []) {
  if (!item.id || !item.canonicalName) errors.push('Every terpene requires id and canonicalName');
  if (seen.has(item.id)) errors.push(`Duplicate terpene id: ${item.id}`);
  seen.add(item.id);
  if (!/^[a-z0-9-]+$/.test(item.id || '')) errors.push(`Invalid stable id: ${item.id}`);
  if (!['monoterpene','sesquiterpene','diterpene','triterpene','other-terpene','terpenoid'].includes(item.class)) errors.push(`Invalid class for ${item.id}`);
  if (!['cannabis-reported','global-terpene','both'].includes(item.scope)) errors.push(`Invalid scope for ${item.id}`);
  if (!['reported','not-yet-verified','conflicting'].includes(item.cannabisOccurrence)) errors.push(`Invalid Cannabis occurrence state for ${item.id}`);
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) errors.push(`Missing evidence for ${item.id}`);
  for (const sourceId of item.evidence || []) if (!sourceIds.has(sourceId)) errors.push(`Unknown source ${sourceId} for ${item.id}`);
  if (!Array.isArray(item.aliases)) errors.push(`aliases must be an array for ${item.id}`);
  if (!Array.isArray(item.aromaDescriptors)) errors.push(`aromaDescriptors must be an array for ${item.id}`);
  if (!item.formula) errors.push(`Missing molecular formula for ${item.id}`);
}

if ((catalog?.compounds || []).length < 10) errors.push('Seed catalog unexpectedly small');
if (!String(catalog?.status || '').includes('expansion')) errors.push('Catalog must remain explicitly incomplete until full inventories are imported');

const index = fs.existsSync(path.join(sourceRoot,'index.html')) ? fs.readFileSync(path.join(sourceRoot,'index.html'),'utf8') : '';
for (const token of ['/terpene-atlas/terpene-atlas-v1.css','/terpene-atlas/terpene-atlas-v1.js','data-search','data-class-filter','data-scope-filter','data-compare-a','/atlas/trichomes-resin/']) {
  if (!index.includes(token)) errors.push(`Terpene Atlas index missing UI contract: ${token}`);
}

const runtime = fs.existsSync(path.join(sourceRoot,'terpene-atlas-v1.js')) ? fs.readFileSync(path.join(sourceRoot,'terpene-atlas-v1.js'),'utf8') : '';
for (const token of ['terpene-catalog-v1.json','sources-v1.json','renderCompare','data-result-count','cache:\'no-store\'']) {
  if (!runtime.includes(token)) errors.push(`Terpene Atlas runtime missing contract: ${token}`);
}

if (errors.length) {
  console.error(`Terpene Atlas validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Terpene Atlas valid: ${catalog.compounds.length} seed compounds, ${sourceIds.size} registered sources, searchable/filterable explorer, comparison runtime, source/public mirror parity, and versioned sample-first data contracts.`);
