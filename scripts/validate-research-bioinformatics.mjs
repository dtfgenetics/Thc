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
  'data/research/usda-hemp-project-family-v1.json',
  'data/research/cornell-published-marker-registry-v1.json',
  'data/research/hemp-data-availability-index-v1.json',
  'data/research/public-cannabis-genomics-datasets-v1.json',
  'data/research/sequence-sample-record.schema.json',
  'data/research/research-acquisition-contract-v1.json',
  'data/research/cannabis-genomics-reproducibility-v1.json',
  'data/research/biosample-record.schema.json',
  'data/research/pilots/feral-cannabis-prjna1206134-pilot-v1.json',
  'data/research/pilots/feral-cannabis-prjna1206134-run-batch-v1.json'
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
const germplasmSchema = JSON.parse(fs.readFileSync(path.join(root,'data/research/germplasm-record.schema.json'),'utf8'));
const passportMapping = importContract.passport_field_mapping || {};
const passportTraits = vocabulary.traits.filter(t => t.category === 'passport').map(t => t.trait_name);
for (const traitName of passportTraits) {
  const target = passportMapping[traitName];
  if (!target) {
    errors.push(`passport trait missing explicit target mapping: ${traitName}`);
    continue;
  }
  if (!germplasmSchema.properties?.[target]) errors.push(`passport target absent from germplasm schema: ${traitName} -> ${target}`);
}
for (const sourceName of Object.keys(passportMapping)) {
  if (!passportTraits.includes(sourceName)) errors.push(`passport mapping references non-passport vocabulary field: ${sourceName}`);
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

const publishedMarkers = JSON.parse(fs.readFileSync(path.join(root,'data/research/cornell-published-marker-registry-v1.json'),'utf8'));
const genomeRegistry = JSON.parse(fs.readFileSync(path.join(root,'data/research/cannabis-reference-genomes-v1.json'),'utf8'));
const assemblyIds = new Set((genomeRegistry.references || []).map(r => r.assembly_accession).filter(Boolean));
if (!assemblyIds.has(publishedMarkers.source.assembly_accession)) {
  errors.push(`published marker assembly not present in genome registry: ${publishedMarkers.source.assembly_accession}`);
}
const markerIds = new Set();
for (const marker of publishedMarkers.loci || []) {
  if (markerIds.has(marker.marker_id)) errors.push(`duplicate published marker id: ${marker.marker_id}`);
  markerIds.add(marker.marker_id);
  if (!Number.isInteger(marker.position) || marker.position < 1) errors.push(`invalid marker position: ${marker.marker_id}`);
}
const availability = JSON.parse(fs.readFileSync(path.join(root,'data/research/hemp-data-availability-index-v1.json'),'utf8'));
for (const resource of availability.resources || []) {
  if (resource.ingestion_lane?.includes('TRAIN') && resource.rights_note?.toLowerCase().includes('reserved')) {
    errors.push(`rights-restricted resource cannot be training lane: ${resource.id}`);
  }
}
if (errors.length) {
  console.error('Bioinformatics marker/data-availability validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Published marker/data-availability validation passed for ${markerIds.size} marker records and ${availability.resources.length} research resources.`);

const publicDatasets = JSON.parse(fs.readFileSync(path.join(root,'data/research/public-cannabis-genomics-datasets-v1.json'),'utf8'));
const datasetIds = new Set();
for (const ds of publicDatasets.datasets || []) {
  if (datasetIds.has(ds.id)) errors.push(`duplicate public genomics dataset id: ${ds.id}`);
  datasetIds.add(ds.id);
  if (!ds.ingestion_lane) errors.push(`missing ingestion lane: ${ds.id}`);
}
const acquisitionContract = JSON.parse(fs.readFileSync(path.join(root,'data/research/research-acquisition-contract-v1.json'),'utf8'));
if (!acquisitionContract.grin?.official_workflow?.observation_export?.length) errors.push('GRIN observation export workflow missing');
if (!acquisitionContract.ncbi_sra?.landing_policy?.command) errors.push('NCBI SRA acquisition command missing');
if (errors.length) {
  console.error('Public genomics/acquisition validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Public genomics/acquisition validation passed for ${datasetIds.size} dataset families.`);

const reproducibility = JSON.parse(fs.readFileSync(path.join(root,'data/research/cannabis-genomics-reproducibility-v1.json'),'utf8'));
const reproducibilityIds = new Set();
for (const resource of reproducibility.resources || []) {
  if (reproducibilityIds.has(resource.id)) errors.push(`duplicate reproducibility resource id: ${resource.id}`);
  reproducibilityIds.add(resource.id);
  if (!resource.url && !resource.doi) errors.push(`reproducibility resource missing locator: ${resource.id}`);
  if (resource.reuse_status === 'INGESTIBLE_PUBLIC_DATA' && !resource.license) errors.push(`ingestible public data must declare license: ${resource.id}`);
}
if (errors.length) {
  console.error('Reproducibility registry validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Reproducibility registry validation passed for ${reproducibilityIds.size} resources.`);

const pilot = JSON.parse(fs.readFileSync(path.join(root,'data/research/pilots/feral-cannabis-prjna1206134-pilot-v1.json'),'utf8'));
const biosampleSchema = JSON.parse(fs.readFileSync(path.join(root,'data/research/biosample-record.schema.json'),'utf8'));
const sequenceSchema = JSON.parse(fs.readFileSync(path.join(root,'data/research/sequence-sample-record.schema.json'),'utf8'));
if (!biosampleSchema.properties?.biosample || !sequenceSchema.properties?.experiment_accession || !sequenceSchema.properties?.sra_sample_accession) {
  errors.push('BioSample/SRA canonical identity fields missing from schemas');
}
if (pilot.biosample?.biosample !== pilot.sequence_run?.biosample) errors.push('pilot BioSample does not match sequence run BioSample');
if (pilot.biosample?.sample_name !== pilot.sequence_run?.sample_name) errors.push('pilot sample name does not match sequence run sample name');
if (pilot.biosample?.bioproject !== pilot.sequence_run?.bioproject) errors.push('pilot BioProject does not match sequence run BioProject');
if (pilot.sequence_run?.bases !== null || pilot.sequence_run?.bytes !== null) {
  errors.push('pilot must not fabricate exact bases/bytes from rounded NCBI display values');
}
if (!acquisitionContract.ncbi_biosample?.command) errors.push('NCBI BioSample acquisition command missing');
if (errors.length) {
  console.error('BioSample/SRA pilot validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`BioSample/SRA pilot validation passed for ${pilot.biosample.biosample} / ${pilot.sequence_run.run_accession}.`);

const runBatch = JSON.parse(fs.readFileSync(path.join(root,'data/research/pilots/feral-cannabis-prjna1206134-run-batch-v1.json'),'utf8'));
const runIds = new Set();
const experimentIds = new Set();
for (const record of runBatch.records || []) {
  if (runIds.has(record.run_accession)) errors.push(`duplicate pilot run accession: ${record.run_accession}`);
  runIds.add(record.run_accession);
  if (experimentIds.has(record.experiment_accession)) errors.push(`duplicate pilot experiment accession: ${record.experiment_accession}`);
  experimentIds.add(record.experiment_accession);
  if (record.bioproject !== runBatch.bioproject) errors.push(`pilot BioProject mismatch: ${record.run_accession}`);
  if (record.study_accession !== runBatch.study_accession) errors.push(`pilot SRA study mismatch: ${record.run_accession}`);
  if (record.bases !== null || record.bytes !== null) errors.push(`rounded NCBI sizes must not become exact values: ${record.run_accession}`);
  if (!record.biosample || !record.sra_sample_accession || !record.experiment_accession) errors.push(`incomplete SRA identity chain: ${record.run_accession}`);
}
if (runIds.size < 2) errors.push('public genomics run batch must prove at least two distinct records');
if (errors.length) {
  console.error('Public genomics run-batch validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Public genomics run-batch validation passed for ${runIds.size} verified runs.`);
