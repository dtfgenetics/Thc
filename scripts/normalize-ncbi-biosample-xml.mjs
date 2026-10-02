#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function decodeXml(value='') {
  return String(value)
    .replaceAll('&lt;','<').replaceAll('&gt;','>')
    .replaceAll('&quot;','"').replaceAll('&apos;',"'")
    .replaceAll('&amp;','&');
}
function tag(xml,name) {
  const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return m ? decodeXml(m[1].replace(/<[^>]+>/g,'').trim()) : null;
}
function attr(xml,name) {
  const m=xml.match(new RegExp(`\\b${name}="([^"]*)"`,'i'));
  return m ? decodeXml(m[1]) : null;
}
function primaryId(xml,db) {
  const re=new RegExp(`<PrimaryId[^>]*db="${db}"[^>]*>([^<]+)<\\/PrimaryId>`,'i');
  const m=xml.match(re); return m?decodeXml(m[1].trim()):null;
}
function normalizeAttributeName(value='') {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g,'_');
}
function parseBioSamples(xml,{sourceId,retrievedAt}) {
  const chunks=[...xml.matchAll(/<BioSample\b[\s\S]*?<\/BioSample>/gi)].map(m=>m[0]);
  const records=[],quarantine=[];
  chunks.forEach((chunk,index)=>{
    const biosample=primaryId(chunk,'BioSample') || attr(chunk,'accession');
    const organismBlock=chunk.match(/<Organism\b[\s\S]*?<\/Organism>/i)?.[0] || '';
    const organism=tag(organismBlock,'OrganismName') || tag(chunk,'OrganismName');
    if(!biosample || !organism){
      quarantine.push({record:index+1,reason:'missing identity',biosample:biosample||null,organism:organism||null});
      return;
    }
    const attrs={};
    for(const m of chunk.matchAll(/<Attribute\b([^>]*)>([\s\S]*?)<\/Attribute>/gi)){
      const meta=m[1], raw=decodeXml(m[2].replace(/<[^>]+>/g,'').trim());
      const name=attr(meta,'harmonized_name') || attr(meta,'attribute_name') || attr(meta,'display_name') || 'unknown_attribute';
      attrs[normalizeAttributeName(name)]=raw;
    }
    const project=primaryId(chunk,'BioProject') || tag(chunk,'BioProject');
    const sampleName=primaryId(chunk,'SRA') ? (attrs.cultivar || attrs.sample_name || tag(chunk,'Title')) : (attrs.cultivar || attrs.sample_name || tag(chunk,'Title'));
    records.push({
      record_id:`BIOSAMPLE-${biosample}`,
      source_id:sourceId,
      biosample,
      sample_name:sampleName || null,
      sra_sample_accession:primaryId(chunk,'SRA') || null,
      bioproject:project || attrs.project_accession || null,
      organism,
      package:tag(chunk,'Package'),
      cultivar:attrs.cultivar || null,
      tissue:attrs.tissue || null,
      collection_date:attrs.collection_date || null,
      geo_loc_name:attrs.geo_loc_name || attrs.geographic_location || null,
      sex:attrs.sex || null,
      accession_id:attrs.grin_accession || attrs.accession_id || null,
      grin_puid:attrs.puid || null,
      attributes:attrs,
      submission:null,
      provenance:{
        source_url:`https://www.ncbi.nlm.nih.gov/biosample/${biosample}`,
        retrieved_at:retrievedAt,
        source_record_id:biosample
      }
    });
  });
  return {records,quarantine};
}
function selfTest(){
  const xml=`<BioSampleSet><BioSample accession="SAMN46071458"><SampleId><PrimaryId db="BioSample">SAMN46071458</PrimaryId><PrimaryId db="SRA">SRS23688594</PrimaryId></SampleId><Descriptor><Title>Plant sample from Cannabis sativa</Title></Descriptor><Organism taxonomy_id="3483"><OrganismName>Cannabis sativa</OrganismName></Organism><BioProject><PrimaryId db="BioProject">PRJNA1206134</PrimaryId></BioProject><Package>Plant; version 1.0</Package><Attributes><Attribute attribute_name="cultivar" harmonized_name="cultivar">ND-23-AA-02-12</Attribute><Attribute attribute_name="collection date" harmonized_name="collection_date">2023</Attribute><Attribute attribute_name="geographic location" harmonized_name="geo_loc_name">USA: ND</Attribute><Attribute attribute_name="tissue" harmonized_name="tissue">Leaf</Attribute></Attributes></BioSample></BioSampleSet>`;
  const out=parseBioSamples(xml,{sourceId:'FERAL-CANNABIS-PRJNA1206134',retrievedAt:'2026-10-02'});
  const errors=[];
  if(out.records.length!==1) errors.push('expected one BioSample record');
  const r=out.records[0];
  if(r?.biosample!=='SAMN46071458'||r?.bioproject!=='PRJNA1206134'||r?.cultivar!=='ND-23-AA-02-12'||r?.geo_loc_name!=='USA: ND') errors.push('BioSample field mapping failed');
  if(out.quarantine.length!==0) errors.push('unexpected BioSample quarantine');
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  console.log('NCBI BioSample XML normalizer self-test passed.');
}
const args=process.argv.slice(2);
if(args.includes('--self-test')) selfTest();
else{
  const [input,output,sourceId,retrievedAt]=args;
  if(!input||!output||!sourceId){
    console.error('Usage: node scripts/normalize-ncbi-biosample-xml.mjs <biosample.xml> <output.jsonl> <source-id> [retrieved-date]');
    process.exit(2);
  }
  const out=parseBioSamples(fs.readFileSync(input,'utf8'),{sourceId,retrievedAt:retrievedAt||new Date().toISOString().slice(0,10)});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,out.records.map(x=>JSON.stringify(x)).join('\n')+(out.records.length?'\n':''));
  fs.writeFileSync(output.replace(/\.jsonl$/,'')+'.quarantine.jsonl',out.quarantine.map(x=>JSON.stringify(x)).join('\n')+(out.quarantine.length?'\n':''));
  console.log(JSON.stringify({records:out.records.length,quarantine:out.quarantine.length,output},null,2));
}
