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
  'data/research/grin-hemp-import-contract-v1.json'
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
