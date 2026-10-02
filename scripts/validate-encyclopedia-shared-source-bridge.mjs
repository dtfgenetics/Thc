#!/usr/bin/env node
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('content/encyclopedia/evidence/authoritative-sources.json','utf8'));
const batch=JSON.parse(fs.readFileSync('content/encyclopedia/evidence/evidence-batch-003.json','utf8'));
const errors=[];
const byAlias=new Map();
for(const source of registry.sources||[]){
  byAlias.set(source.id,source.id);
  for(const alias of source.aliases||[]) byAlias.set(alias,source.id);
}
const requiredAliases=[
  'pubchem_pug_rest',
  'usda_hemp_phenotyping_handbook_v4_2025',
  'miappe_v1_2_2024',
  'usda_grin_cannabis_sativa_taxon_8862',
  'cornell_hemp_usda_ars_germplasm_2024',
  'cornell_toth_hemp_genetics_2022'
];
for(const alias of requiredAliases) if(!byAlias.has(alias)) errors.push(`missing shared-source alias: ${alias}`);
if(batch.batchId!=='ENC-EVID-BATCH-003') errors.push('shared-source evidence batch id mismatch');
if(batch.reviewState!=='needs_independent_science_review') errors.push('shared-source batch must remain review-pending');
if(batch.publicationEffect!=='none_review_state_unchanged') errors.push('shared-source batch cannot change publication state');
const requiredLessons=['THC-ENC-001','THC-ENC-150','THC-ENC-203','THC-ENC-247','THC-ENC-250','THC-ENC-399','THC-ENC-409','THC-ENC-416'];
const seen=new Set((batch.claimEvidence||[]).map(x=>x.lessonId));
for(const id of requiredLessons) if(!seen.has(id)) errors.push(`shared-source evidence missing lesson mapping: ${id}`);
for(const row of batch.claimEvidence||[]){
  if(row.reviewState!=='source_collected_needs_science_review') errors.push(`${row.evidenceId}: review state changed`);
  if(!(row.sourceIds||[]).length) errors.push(`${row.evidenceId}: sourceIds missing`);
  for(const sourceId of row.sourceIds||[]) if(!(registry.sources||[]).some(s=>s.id===sourceId)) errors.push(`${row.evidenceId}: unknown source ${sourceId}`);
}
if(errors.length){
  console.error(`Shared source bridge validation failed with ${errors.length} error(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Shared source bridge PASS: ${requiredAliases.length} source aliases · ${batch.claimEvidence.length} claim mappings`);
