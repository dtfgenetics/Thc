#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const base = path.join(root, 'apps/growlens-web/public/terpene-atlas/data');
const errors = [];
const readJSON = (name) => {
  try { return JSON.parse(fs.readFileSync(path.join(base, name), 'utf8')); }
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
const seen = new Set();
for (const item of catalog?.compounds || []) {
  if (!item.id || !item.canonicalName) errors.push('Every terpene requires id and canonicalName');
  if (seen.has(item.id)) errors.push(`Duplicate terpene id: ${item.id}`);
  seen.add(item.id);
  if (!['monoterpene','sesquiterpene','diterpene','triterpene','other-terpene','terpenoid'].includes(item.class)) errors.push(`Invalid class for ${item.id}`);
  if (!['cannabis-reported','global-terpene','both'].includes(item.scope)) errors.push(`Invalid scope for ${item.id}`);
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) errors.push(`Missing evidence for ${item.id}`);
  for (const sourceId of item.evidence || []) if (!sourceIds.has(sourceId)) errors.push(`Unknown source ${sourceId} for ${item.id}`);
  if (!Array.isArray(item.aromaDescriptors)) errors.push(`aromaDescriptors must be an array for ${item.id}`);
}
if ((catalog?.compounds || []).length < 10) errors.push('Seed catalog unexpectedly small');
if (!String(catalog?.status || '').includes('expansion')) errors.push('Catalog must remain explicitly incomplete until full inventories are imported');

if (errors.length) {
  console.error(`Terpene Atlas validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Terpene Atlas data valid: ${catalog.compounds.length} seed compounds, ${sourceIds.size} registered sources, versioned ontology and sample-profile contracts.`);
