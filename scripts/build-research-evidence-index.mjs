#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DEFAULT_ROOT=path.join(ROOT,'data/research/imported');
const OUT=path.join(ROOT,'data/research/generated/research-evidence-index-v1.json');
const ALLOWED=[
  ['grin','normalized','germplasm.jsonl','germplasm'],
  ['grin','normalized','phenotypes.jsonl','phenotype'],
  ['ncbi','normalized','biosamples.jsonl','biosample'],
  ['ncbi','normalized','sequence-samples.jsonl','sequence_sample'],
];

function readJsonl(file){
  if(!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map((line,i)=>{
    try{return JSON.parse(line)}catch(e){throw new Error(`${file}:${i+1}: invalid JSON: ${e.message}`)}
  });
}
function text(v){return v==null?'':String(v).trim()}
function entry(record,kind){
  const p=record.provenance||{};
  const id=text(record.record_id||record.biosample||record.run_accession||record.accession_id);
  const sourceId=text(record.source_id);
  if(!id||!sourceId||!text(p.source_url)||!text(p.retrieved_at)) throw new Error(`${kind}: record missing identity/provenance`);
  const labels=[
    record.accession_id,record.plant_name,record.taxon,record.trait_name,record.trait_label,
    record.biosample,record.sample_name,record.cultivar,record.organism,record.bioproject,
    record.run_accession,record.library_strategy,record.platform
  ].map(text).filter(Boolean);
  return {
    evidence_id:`${kind}:${id}`,
    kind,
    source_id:sourceId,
    record_id:id,
    labels:[...new Set(labels)],
    provenance:{source_url:text(p.source_url),retrieved_at:text(p.retrieved_at),source_record_id:text(p.source_record_id)||null},
    population_scope:kind==='germplasm'?text(record.population_scope)||'public_reference':'public_reference',
    use_policy:{retrieval:true,training:false,heldout_eval:false,direct_dtf_cultivar_inference:false}
  };
}
export function build(root=DEFAULT_ROOT){
  const entries=[];
  for(const [provider,folder,name,kind] of ALLOWED){
    for(const record of readJsonl(path.join(root,provider,folder,name))) entries.push(entry(record,kind));
  }
  entries.sort((a,b)=>a.evidence_id.localeCompare(b.evidence_id));
  const seen=new Set();
  for(const e of entries){if(seen.has(e.evidence_id)) throw new Error(`duplicate evidence_id: ${e.evidence_id}`);seen.add(e.evidence_id)}
  return {schema_version:'dtf-research-evidence-index-v1',generated_from:'normalized_research_records',policy:{purpose:'retrieval_reference',training_eligible:false,heldout_eval_eligible:false,dtf_cultivar_inference:false},entries};
}
function selfTest(){
  const tmp=fs.mkdtempSync(path.join(process.env.TMPDIR||'/tmp','dtf-evidence-'));
  const dir=path.join(tmp,'grin/normalized');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'germplasm.jsonl'),JSON.stringify({record_id:'grin:PI1',source_id:'usda_grin',accession_id:'PI1',taxon:'Cannabis sativa',population_scope:'public hemp germplasm',plant_name:'Example',provenance:{source_url:'https://example.org/PI1',retrieved_at:'2026-10-02'}})+'\n');
  const out=build(tmp);if(out.entries.length!==1||out.entries[0].use_policy.training!==false||out.entries[0].record_id!=='grin:PI1') throw new Error('self-test failed');
  fs.rmSync(tmp,{recursive:true,force:true});console.log('research evidence index self-test: PASS');
}
if(process.argv.includes('--self-test')) selfTest();
else {const out=build();fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');console.log(`research evidence index: ${out.entries.length} records`)}
