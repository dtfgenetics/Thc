#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export function tokenize(value){
  return String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
}
export function queryEvidence(index, query, options={}){
  if(index?.schema_version!=='dtf-research-evidence-index-v1') throw new Error('unsupported research evidence index');
  const terms=[...new Set(tokenize(query))];
  if(!terms.length) return [];
  const kinds=new Set((options.kinds||[]).map(String));
  const limit=Math.max(1,Math.min(Number(options.limit)||20,100));
  return (index.entries||[]).filter(e=>!kinds.size||kinds.has(e.kind)).map(e=>{
    const fields=[e.record_id,e.source_id,e.population_scope,...(e.labels||[])];
    const tokens=new Set(fields.flatMap(tokenize));
    const matched=terms.filter(t=>tokens.has(t));
    return {e,matched,score:matched.length/terms.length};
  }).filter(x=>x.matched.length).sort((a,b)=>b.score-a.score||b.matched.length-a.matched.length||a.e.evidence_id.localeCompare(b.e.evidence_id)).slice(0,limit).map(({e,matched,score})=>({
    evidence_id:e.evidence_id,kind:e.kind,source_id:e.source_id,record_id:e.record_id,labels:e.labels,
    population_scope:e.population_scope,provenance:e.provenance,use_policy:e.use_policy,
    match:{terms:matched,score:Number(score.toFixed(4))}
  }));
}
function selfTest(){
  const idx={schema_version:'dtf-research-evidence-index-v1',entries:[
    {evidence_id:'germplasm:a',kind:'germplasm',source_id:'grin',record_id:'PI1',labels:['Cannabis sativa','powdery mildew'],population_scope:'public hemp germplasm',provenance:{source_url:'https://example.org',retrieved_at:'2026-10-02'},use_policy:{retrieval:true,training:false,heldout_eval:false,direct_dtf_cultivar_inference:false}},
    {evidence_id:'biosample:b',kind:'biosample',source_id:'ncbi',record_id:'SAMN1',labels:['Cannabis sativa','leaf'],population_scope:'public_reference',provenance:{source_url:'https://example.org/b',retrieved_at:'2026-10-02'},use_policy:{retrieval:true,training:false,heldout_eval:false,direct_dtf_cultivar_inference:false}}
  ]};
  const a=queryEvidence(idx,'powdery mildew');
  if(a.length!==1||a[0].record_id!=='PI1'||a[0].match.score!==1) throw new Error('ranking self-test failed');
  const b=queryEvidence(idx,'cannabis',{kinds:['biosample']});
  if(b.length!==1||b[0].kind!=='biosample'||b[0].use_policy.training!==false) throw new Error('filter/policy self-test failed');
  console.log('research evidence query self-test: PASS');
}
if(process.argv.includes('--self-test')) selfTest();
else {
  const q=process.argv.slice(2).join(' ').trim(); if(!q){console.error('usage: node scripts/query-research-evidence.mjs <query>');process.exit(2)}
  const file=path.join(process.cwd(),'data/research/generated/research-evidence-index-v1.json');
  if(!fs.existsSync(file)){console.error('research evidence index not built; run npm run build:research-evidence-index');process.exit(2)}
  console.log(JSON.stringify(queryEvidence(JSON.parse(fs.readFileSync(file,'utf8')),q),null,2));
}
