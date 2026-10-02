#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'data/research/cornell-bioinformatics-registry.json',
  'data/research/cornell-bioinformatics-registry.schema.json',
  'data/research/germplasm-record.schema.json',
  'data/research/phenotype-observation.schema.json',
  'data/research/genotype-marker-call.schema.json',
  'data/research/cornell-usda-payload-discovery-v1.json',
  'data/research/usda-hemp-trait-vocabulary-v4.json',
  'data/research/grin-hemp-import-contract-v1.json',
  'data/research/experiment-record.schema.json',
  'data/research/chemotype-observation.schema.json',
  'data/research/lineage-record.schema.json',
  'data/research/provenance-envelope.schema.json',
  'data/research/interoperability-standards-v1.json',
  'data/research/brapi-2.1-mapping-v1.json',
  'data/research/cornell-hemp-genetics-literature-v1.json',
  'data/research/cannabis-reference-genomes-v1.json',
  'data/research/usda-hemp-project-family-v1.json'
];

const errors = [];
for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    errors.push(`${rel}: invalid JSON: ${error.message}`);
  }
}

if (errors.length) {
  console.error('Bioinformatics research validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const discovery = JSON.parse(fs.readFileSync(path.join(root,'data/research/cornell-usda-payload-discovery-v1.json'),'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root,'data/research/cornell-bioinformatics-registry.json'),'utf8'));
const ids = new Set(registry.sources.map(source => source.id));
for (const finding of discovery.findings) {
  if (!ids.has(finding.source_id) && !finding.source_id.startsWith('USDA-ARS-GRIN-')) {
    errors.push(`discovery source not registered: ${finding.source_id}`);
  }
}
if (errors.length) {
  console.error('Bioinformatics cross-reference validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Bioinformatics research validation passed for ${files.length} JSON files and ${discovery.findings.length} discovery findings.`);

const vocabulary = JSON.parse(fs.readFileSync(path.join(root,'data/research/usda-hemp-trait-vocabulary-v4.json'),'utf8'));
const names = new Set();
for (const trait of vocabulary.traits) {
  if (!trait.trait_name || names.has(trait.trait_name)) errors.push(`duplicate/blank trait: ${trait.trait_name}`);
  names.add(trait.trait_name);
  if (trait.datatype === 'placeholder' && !trait.trait_name.includes('xxx') && trait.trait_name !== 'non_fiber') {
    errors.push(`placeholder trait not explicitly recognizable: ${trait.trait_name}`);
  }
}
const importContract = JSON.parse(fs.readFileSync(path.join(root,'data/research/grin-hemp-import-contract-v1.json'),'utf8'));
if (importContract.target_vocabulary !== vocabulary.vocabulary_id) {
  errors.push('GRIN import contract vocabulary id does not match trait vocabulary');
}
if (errors.length) {
  console.error('Bioinformatics vocabulary/import validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`USDA hemp vocabulary validated: ${vocabulary.traits.length} named fields/traits.`);

const schemaRequirements = registry.canonical_record_requirements || {};
for (const [entity, config] of Object.entries(schemaRequirements)) {
  const schemaPath = path.join(root, config.schema);
  if (!fs.existsSync(schemaPath)) {
    errors.push(`${entity}: missing schema ${config.schema}`);
    continue;
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath,'utf8'));
  const expected = JSON.stringify([...(schema.required || [])].sort());
  const declared = JSON.stringify([...(config.required || [])].sort());
  if (expected !== declared) errors.push(`${entity}: registry required fields differ from schema.required`);
}
const standards = JSON.parse(fs.readFileSync(path.join(root,'data/research/interoperability-standards-v1.json'),'utf8'));
for (const [entity, map] of Object.entries(standards.dtf_entity_mapping || {})) {
  if (!fs.existsSync(path.join(root,map.schema))) errors.push(`standards mapping missing schema for ${entity}: ${map.schema}`);
}
const projects = JSON.parse(fs.readFileSync(path.join(root,'data/research/usda-hemp-project-family-v1.json'),'utf8'));
const projectIds = new Set();
for (const project of projects.projects || []) {
  if (projectIds.has(project.id)) errors.push(`duplicate USDA project id: ${project.id}`);
  projectIds.add(project.id);
  if (!project.url?.includes(project.accn_no)) errors.push(`USDA project URL/accession mismatch: ${project.id}`);
}
const genomes = JSON.parse(fs.readFileSync(path.join(root,'data/research/cannabis-reference-genomes-v1.json'),'utf8'));
const genomeIds = new Set();
for (const ref of genomes.references || []) {
  if (genomeIds.has(ref.id)) errors.push(`duplicate genome reference id: ${ref.id}`);
  genomeIds.add(ref.id);
  if (ref.public_sequence_status === 'NO_PUBLIC_PROJECT_DATA_LINKED_AT_AUDIT_TIME' && ref.use_status !== 'REFERENCE_METADATA_ONLY') {
    errors.push(`unreleased genome reference cannot be ingestible: ${ref.id}`);
  }
}
const brapi = JSON.parse(fs.readFileSync(path.join(root,'data/research/brapi-2.1-mapping-v1.json'),'utf8'));
if (brapi.standard !== 'BrAPI 2.1') errors.push('BrAPI mapping must declare BrAPI 2.1');
if (errors.length) {
  console.error('Bioinformatics schema/standards validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Bioinformatics schema/standards validation passed for ${Object.keys(schemaRequirements).length} canonical entity families.`);
