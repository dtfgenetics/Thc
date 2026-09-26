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
  'data/population-summary-v1.json',
  'data/sample-profiles-v1.json',
  'data/profile-factors-v1.json',
  'data/evidence-claims-v1.json',
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
const population = readJSON('population-summary-v1.json');
const profiles = readJSON('sample-profiles-v1.json');
const factors = readJSON('profile-factors-v1.json');
const evidenceClaims = readJSON('evidence-claims-v1.json');
const schema = readJSON('terpene-schema-v1.json');

if (schema?.schemaVersion !== 1) errors.push('terpene-schema-v1.json must use schemaVersion 1');
if (catalog?.schemaVersion !== 1) errors.push('terpene-catalog-v1.json must use schemaVersion 1');
if (sampleSchema?.schemaVersion !== 1) errors.push('sample-profile-schema-v1.json must use schemaVersion 1');

const sourceIds = new Set((sources?.sources || []).map((s) => s.id));
if (sourceIds.size < 6) errors.push('Terpene Atlas source registry is unexpectedly small');

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

if ((catalog?.compounds || []).length < 90) errors.push('Terpene Atlas curated ontology must contain at least 90 evidence-backed named compounds');
if (!String(catalog?.status || '').includes('expansion')) errors.push('Catalog must remain explicitly incomplete until full inventories are imported');
if (catalog?.coverage?.completenessClaim !== false) errors.push('Terpene Atlas must not claim complete global/Cannabis terpene coverage yet');
if (catalog?.coverage?.currentCuratedCompounds !== catalog?.compounds?.length) errors.push('Terpene Atlas coverage count must equal the actual compound count');

if (population?.schemaVersion !== 1) errors.push('population-summary-v1.json must use schemaVersion 1');
if (population?.sampleCount !== 79) errors.push('Population summary must preserve the published n=79 inflorescence context');
if (population?.unit !== 'ppm') errors.push('Population summary must preserve ppm units');
if (!Array.isArray(population?.analytes) || population.analytes.length < 40) errors.push('Population summary must contain at least 40 mapped analytes');
for (const row of population?.analytes || []) {
  if (!seen.has(row.compoundId)) errors.push(`Population analyte is not present in ontology: ${row.compoundId}`);
  for (const field of ['minPpm','meanPpm','sdPpm','cvPercent']) if (!Number.isFinite(row[field])) errors.push(`Population analyte ${row.compoundId} missing numeric ${field}`);
}
if (profiles?.schemaVersion !== 1 || !Array.isArray(profiles?.profiles)) errors.push('sample-profiles-v1.json must provide a versioned profiles array');
if (factors?.schemaVersion !== 1 || !Array.isArray(factors?.factors) || factors.factors.length < 8) errors.push('profile-factors-v1.json must provide at least eight interpretation factors');
if (evidenceClaims?.schemaVersion !== 1) errors.push('evidence-claims-v1.json must use schemaVersion 1');
if (!Array.isArray(evidenceClaims?.compoundEvidence) || evidenceClaims.compoundEvidence.length < 3) errors.push('Evidence claims need compound-specific records');
if (!Array.isArray(evidenceClaims?.safety) || evidenceClaims.safety.length < 3) errors.push('Evidence claims need safety/context records');
for (const claim of evidenceClaims?.compoundEvidence || []) {
  if (!seen.has(claim.compoundId)) errors.push(`Evidence claim maps to unknown compound: ${claim.compoundId}`);
  if (!Array.isArray(claim.evidenceModels) || claim.evidenceModels.length < 1) errors.push(`Evidence claim ${claim.compoundId} missing evidence model`);
  if (!claim.humanEvidenceStatus || !claim.limitations) errors.push(`Evidence claim ${claim.compoundId} must state human evidence and limitations`);
  for (const sourceId of claim.sources || []) if (!sourceIds.has(sourceId)) errors.push(`Unknown evidence source ${sourceId} for ${claim.compoundId}`);
}
for (const item of evidenceClaims?.safety || []) for (const sourceId of item.sources || []) if (!sourceIds.has(sourceId)) errors.push(`Unknown safety source ${sourceId} for ${item.id}`);
for (const factor of factors?.factors || []) {
  if (!factor.id || !factor.title || !factor.category || !factor.summary || !factor.caution) errors.push(`Incomplete profile factor: ${factor?.id || '(unknown)'}`);
  if (!Array.isArray(factor.whatToRecord) || factor.whatToRecord.length < 3) errors.push(`Profile factor ${factor.id} needs recording guidance`);
  if (!Array.isArray(factor.evidence) || factor.evidence.length < 1) errors.push(`Profile factor ${factor.id} needs evidence`);
  for (const sourceId of factor.evidence || []) if (!sourceIds.has(sourceId)) errors.push(`Unknown factor source ${sourceId} for ${factor.id}`);
}

const index = fs.existsSync(path.join(sourceRoot,'index.html')) ? fs.readFileSync(path.join(sourceRoot,'index.html'),'utf8') : '';
for (const token of ['/terpene-atlas/terpene-atlas-v1.css','/terpene-atlas/terpene-atlas-v1.js','class="skip-link"','id="main-content"','data-wheel-family','data-search','data-class-filter','data-scope-filter','data-population-body','data-profile-file','data-compound-dialog','aria-modal="true"','aria-live="polite"','data-factor-grid','data-factor-category','data-general-evidence','data-safety-grid','data-source-grid','data-compare-a','/atlas/trichomes-resin/']) {
  if (!index.includes(token)) errors.push(`Terpene Atlas index missing UI contract: ${token}`);
}

const runtime = fs.existsSync(path.join(sourceRoot,'terpene-atlas-v1.js')) ? fs.readFileSync(path.join(sourceRoot,'terpene-atlas-v1.js'),'utf8') : '';
for (const token of ['terpene-catalog-v1.json','sources-v1.json','population-summary-v1.json','sample-profiles-v1.json','renderWheel','renderFactors','renderEvidenceSafety','renderPopulation','renderImportedProfile','showCompound','renderSources','renderCompare','data-result-count','cache:\'no-store\'']) {
  if (!runtime.includes(token)) errors.push(`Terpene Atlas runtime missing contract: ${token}`);
}

const packageScriptPath = path.join(root, 'scripts/package-public-suite-wordpress.py');
const packageScript = fs.existsSync(packageScriptPath) ? fs.readFileSync(packageScriptPath, 'utf8') : '';
for (const token of [
  '"terpene-atlas",',
  '"terpene-atlas/index.html",',
  '"terpene-atlas/terpene-atlas-v1.css",',
  '"terpene-atlas/terpene-atlas-v1.js",',
  '"terpene-atlas/data/terpene-catalog-v1.json",',
  '"terpene-atlas/data/sources-v1.json",',
  '"terpene-atlas/data/population-summary-v1.json",',
  '"terpene-atlas/data/sample-profiles-v1.json",',
]) {
  if (!packageScript.includes(token)) errors.push(`Public-suite package missing Terpene Atlas contract: ${token}`);
}

if (errors.length) {
  console.error(`Terpene Atlas validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`Terpene Atlas valid: ${catalog.compounds.length} evidence-backed named compounds, ${population.analytes.length} measured population analytes across n=${population.sampleCount}, ${sourceIds.size} registered sources, interactive family wheel, searchable explorer, comparisons, source/public mirror parity, and verified-sample ingestion contract.`);
