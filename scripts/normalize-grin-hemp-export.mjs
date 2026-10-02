#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vocabPath = path.join(root,'data/research/usda-hemp-trait-vocabulary-v4.json');
const vocabulary = JSON.parse(fs.readFileSync(vocabPath,'utf8'));
const traitMap = new Map(vocabulary.traits.map(t => [t.trait_name, t]));

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/,'')); rows.push(row); row=[]; cell=''; }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,'')); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

function coerce(raw, datatype) {
  if (raw === '' || raw == null) return null;
  if (datatype === 'int') {
    const n = Number(raw); return Number.isInteger(n) ? n : raw;
  }
  if (datatype === 'decimal') {
    const n = Number(raw); return Number.isFinite(n) ? n : raw;
  }
  if (datatype === 'boolean') {
    const s = String(raw).toLowerCase();
    if (['true','1','yes','y'].includes(s)) return true;
    if (['false','0','no','n'].includes(s)) return false;
  }
  return raw;
}

function normalize(rows, sourceUrl, retrievedAt) {
  if (!rows.length) return {germplasm:[], phenotypes:[], quarantine:[]};
  const headers = rows[0].map(h => h.trim());
  const germplasm=[], phenotypes=[], quarantine=[];
  const passportNames = new Set(vocabulary.traits.filter(t=>t.category==='passport').map(t=>t.trait_name));
  const identityCandidates = ['PUID','puid','ACCESSION','accession','accession_id'];

  rows.slice(1).forEach((values, idx) => {
    const raw={};
    headers.forEach((h,i)=>raw[h]=values[i] ?? '');
    const accession = raw.ACCESSION || raw.accession || raw.accession_id || '';
    const puid = raw.PUID || raw.puid || '';
    const identity = accession || puid;
    if (!identity) {
      quarantine.push({row:idx+2,reason:'missing accession identity',raw});
      return;
    }

    const parsedPassport = {};
    const numericPassportFields = [
      ['ploidy','int',1,null],
      ['number_plants_sampled','int',0,null],
      ['elevation_meters','decimal',null,null],
      ['latitude','decimal',-90,90],
      ['longitude','decimal',-180,180],
      ['uncertainty','decimal',0,null]
    ];
    for (const [name,type,min,max] of numericPassportFields) {
      const value = raw[name];
      if (value === '' || value == null) { parsedPassport[name] = null; continue; }
      const parsed = coerce(value,type);
      const invalidType = typeof parsed === 'string';
      const invalidRange = !invalidType && ((min != null && parsed < min) || (max != null && parsed > max));
      if (invalidType || invalidRange) {
        quarantine.push({row:idx+2,reason:invalidRange?'out of range':'unparseable datatype',column:name,value,expected:type,min,max,accession_id:accession||null,puid:puid||null});
        parsedPassport[name] = null;
      } else parsedPassport[name] = parsed;
    }

    const passport = {
      record_id:`GRIN-GERM-${String(identity).replace(/[^A-Za-z0-9._-]/g,'_')}`,
      source_id:'USDA-ARS-GRIN-HEMP-001',
      accession_id:accession || puid,
      puid:puid || null,
      taxon:raw.TAXONOMY || raw.taxonomy || raw.taxonomy_species_id || 'Cannabis sativa L.',
      taxonomy_species_id:raw.taxonomy_species_id || null,
      plant_name:raw['PLANT NAME'] || raw.plant_name || null,
      population_scope:'USDA NPGS Cannabis sativa germplasm',
      improvement_status:raw['IMPROVEMENT LEVEL'] || raw.improvement_status || null,
      pedigree:raw.accession_pedigree || null,
      ploidy:parsedPassport.ploidy,
      accession_ipr:raw.accession_ipr || null,
      crop_use:raw.crop_use || null,
      origin:raw.ORIGIN || raw.origin || null,
      source_cooperator_id:raw.source_cooperator_id || null,
      collector_cooperator_id:raw.collector_cooperator_id || null,
      developer:raw.developer || null,
      number_plants_sampled:parsedPassport.number_plants_sampled,
      source_date:raw['SOURCE DATE'] || raw.source_date || null,
      geography_id:raw.geography_id || null,
      elevation_meters:parsedPassport.elevation_meters,
      latitude:parsedPassport.latitude,
      longitude:parsedPassport.longitude,
      coordinate_method:raw.coordinate_method || null,
      uncertainty:parsedPassport.uncertainty,
      georeference_datum:raw.georeference_datum || null,
      accession_inv_voucher_note:raw.accession_inv_voucher_note || null,
      provenance:{source_url:sourceUrl,retrieved_at:retrievedAt,source_record_id:puid || accession || null,notes:'Normalized from supplied GRIN/USDA CSV export'}
    };

    let hasPassport = false;
    for (const name of passportNames) if (raw[name] !== undefined && raw[name] !== '') hasPassport = true;
    if (hasPassport || accession || puid) germplasm.push(passport);

    for (const [name,value] of Object.entries(raw)) {
      if (value === '' || identityCandidates.includes(name) || ['PLANT NAME','TAXONOMY','ORIGIN','IMPROVEMENT LEVEL','SOURCE DATE'].includes(name)) continue;
      const trait = traitMap.get(name);
      if (!trait) {
        quarantine.push({row:idx+2,reason:'unknown trait_name',column:name,value,accession_id:accession||null,puid:puid||null});
        continue;
      }
      if (trait.category === 'passport') continue;
      if (trait.datatype === 'placeholder') {
        quarantine.push({row:idx+2,reason:'placeholder trait',column:name,value,accession_id:accession||null,puid:puid||null});
        continue;
      }
      const coerced = coerce(value, trait.datatype);
      if ((trait.datatype === 'int' || trait.datatype === 'decimal') && typeof coerced === 'string') {
        quarantine.push({row:idx+2,reason:'unparseable datatype',column:name,value,expected:trait.datatype,accession_id:accession||null,puid:puid||null});
        continue;
      }
      phenotypes.push({
        record_id:`GRIN-PHENO-${String(identity).replace(/[^A-Za-z0-9._-]/g,'_')}-${name}-${idx+2}`,
        source_id:'USDA-ARS-GRIN-HEMP-001',
        accession_or_plant_id:accession || puid,
        puid:puid || null,
        trait_name:name,
        trait_label:trait.description,
        value:coerced,
        units:trait.units,
        datatype:trait.datatype === 'categorical' || trait.datatype === 'media' ? 'nvarchar' : trait.datatype,
        scoring_method:null,
        developmental_stage:null,
        observation_date:null,
        observation_context:{experiment_id:null,location:null,environment:null,treatment:null,replicate:null},
        provenance:{source_url:sourceUrl,retrieved_at:retrievedAt,source_record_id:puid || accession || null,protocol_reference:vocabulary.source_url}
      });
    }
  });
  return {germplasm, phenotypes, quarantine};
}

function jsonl(items){ return items.map(x=>JSON.stringify(x)).join('\n') + (items.length?'\n':''); }

function selfTest() {
  const csv = [
    'ACCESSION,PUID,PLANT NAME,TAXONOMY,ORIGIN,ploidy,latitude,longitude,elevation_meters,collector_cooperator_id,ht,days_2_female,uav_xxx,unknown_field',
    'G 1,PUID-1,Example,Cannabis sativa L.,US,2,42.1,-77.2,200,COL-1,125.5,52,test,bad',
    'G 2,PUID-2,Example2,Cannabis sativa L.,CA,bad-ploidy,95,-200,bad-elevation,COL-2,not-a-number,60,,'
  ].join('\n');
  const out = normalize(parseCsv(csv),'https://example.test/grin.csv','2026-10-01');
  const fail = [];
  if (out.germplasm.length !== 2) fail.push('expected 2 germplasm records');
  if (out.phenotypes.length !== 3) fail.push('expected 3 valid phenotype observations');
  if (!out.quarantine.some(x=>x.reason==='placeholder trait')) fail.push('missing placeholder quarantine');
  if (!out.quarantine.some(x=>x.reason==='unknown trait_name')) fail.push('missing unknown-trait quarantine');
  if (out.quarantine.filter(x=>x.reason==='unparseable datatype').length < 3) fail.push('missing phenotype/passport datatype quarantine');
  if (out.quarantine.filter(x=>x.reason==='out of range').length < 2) fail.push('missing coordinate range quarantine');
  if (out.germplasm[0]?.latitude !== 42.1 || out.germplasm[0]?.longitude !== -77.2 || out.germplasm[0]?.collector_cooperator_id !== 'COL-1') fail.push('passport metadata was not preserved');
  if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
  console.log('GRIN hemp normalizer self-test passed.');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();
else {
  const input = args[0];
  if (!input) {
    console.error('Usage: node scripts/normalize-grin-hemp-export.mjs <input.csv> [output-dir] [source-url] [retrieved-date]');
    process.exit(2);
  }
  const outputDir = args[1] || path.join(root,'data/research/imported/grin');
  const sourceUrl = args[2] || 'https://npgsweb.ars-grin.gov/gringlobal/search';
  const retrievedAt = args[3] || new Date().toISOString().slice(0,10);
  const rows = parseCsv(fs.readFileSync(input,'utf8'));
  const out = normalize(rows,sourceUrl,retrievedAt);
  fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,'germplasm.jsonl'),jsonl(out.germplasm));
  fs.writeFileSync(path.join(outputDir,'phenotypes.jsonl'),jsonl(out.phenotypes));
  fs.writeFileSync(path.join(outputDir,'quarantine.jsonl'),jsonl(out.quarantine));
  const manifest={input:path.resolve(input),source_url:sourceUrl,retrieved_at:retrievedAt,germplasm_records:out.germplasm.length,phenotype_records:out.phenotypes.length,quarantine_records:out.quarantine.length,vocabulary:vocabulary.vocabulary_id};
  fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest,null,2));
}
