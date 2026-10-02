#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"' && text[i+1]==='"'){cell+='"';i++;}
      else if(c==='"') quoted=false;
      else cell+=c;
    } else {
      if(c==='"') quoted=true;
      else if(c===','){row.push(cell);cell='';}
      else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
      else cell+=c;
    }
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  return rows.filter(r=>r.some(v=>v!==''));
}
function n(v){ if(v==null||v==='') return null; const x=Number(v); return Number.isFinite(x)?x:null; }
function normHeader(h){ return String(h||'').trim(); }
function pick(obj,...keys){ for(const k of keys) if(obj[k]!==undefined && obj[k]!=='') return obj[k]; return null; }

function normalize(text,{sourceId,bioproject,retrievedAt,sourceUrl}) {
  const rows=parseCsv(text);
  if(!rows.length) return {records:[],quarantine:[]};
  const headers=rows[0].map(normHeader), records=[], quarantine=[];
  rows.slice(1).forEach((vals,index)=>{
    const raw={}; headers.forEach((h,i)=>raw[h]=vals[i]??'');
    const run=pick(raw,'Run','run_accession','run');
    const project=pick(raw,'BioProject','bioproject')||bioproject;
    const organism=pick(raw,'ScientificName','Organism','organism');
    if(!run||!project||!organism){
      quarantine.push({row:index+2,reason:'missing identity',missing:{run:!run,bioproject:!project,organism:!organism},raw});
      return;
    }
    const record={
      record_id:`SRA-${run}`,
      source_id:sourceId,
      bioproject:project,
      run_accession:run,
      biosample:pick(raw,'BioSample','biosample'),
      sample_name:pick(raw,'SampleName','Sample Name','sample_name'),
      organism,
      library_strategy:pick(raw,'LibraryStrategy','Library Strategy'),
      library_source:pick(raw,'LibrarySource','Library Source'),
      library_selection:pick(raw,'LibrarySelection','Library Selection'),
      platform:pick(raw,'Platform'),
      instrument:pick(raw,'Model','Instrument','instrument_model'),
      layout:pick(raw,'LibraryLayout','Library Layout'),
      read_length:n(pick(raw,'avgLength','AvgLength','AverageLength')),
      spots:n(pick(raw,'spots','Spots')),
      bases:n(pick(raw,'bases','Bases')),
      bytes:n(pick(raw,'size_MB'))!=null?Math.round(n(pick(raw,'size_MB'))*1024*1024):n(pick(raw,'Bytes','bytes')),
      accession_id:pick(raw,'GRIN_Accession','Accession_ID','accession_id'),
      grin_puid:pick(raw,'PUID','grin_puid'),
      sex:pick(raw,'sex','Sex'),
      assembly_accession:pick(raw,'AssemblyName','AssemblyAccession','assembly_accession'),
      reference_assembly:pick(raw,'ReferenceAssembly','reference_assembly'),
      attributes:{},
      provenance:{source_url:sourceUrl,retrieved_at:retrievedAt,source_record_id:run}
    };
    const known=new Set(['Run','run_accession','run','BioProject','bioproject','ScientificName','Organism','organism','BioSample','biosample','SampleName','Sample Name','sample_name','LibraryStrategy','Library Strategy','LibrarySource','Library Source','LibrarySelection','Library Selection','Platform','Model','Instrument','instrument_model','LibraryLayout','Library Layout','avgLength','AvgLength','AverageLength','spots','Spots','bases','Bases','size_MB','Bytes','bytes','GRIN_Accession','Accession_ID','accession_id','PUID','grin_puid','sex','Sex','AssemblyName','AssemblyAccession','assembly_accession','ReferenceAssembly','reference_assembly']);
    for(const [k,v] of Object.entries(raw)) if(v!==''&&!known.has(k)) record.attributes[k]=v;
    records.push(record);
  });
  return {records,quarantine};
}
function selfTest(){
  const csv='Run,BioProject,BioSample,ScientificName,LibraryStrategy,Platform,spots,bases,size_MB,sex\nSRR1,PRJNA1,SAMN1,Cannabis sativa,WGS,PACBIO_SMRT,10,1000,2.5,male\n,PRJNA1,SAMN2,Cannabis sativa,WGS,ILLUMINA,1,100,1,female';
  const out=normalize(csv,{sourceId:'TEST',bioproject:'PRJNA1',retrievedAt:'2026-10-01',sourceUrl:'https://example.test'});
  const errors=[];
  if(out.records.length!==1) errors.push('expected one valid SRA record');
  if(out.quarantine.length!==1) errors.push('expected one quarantined SRA row');
  if(out.records[0]?.bytes!==2621440) errors.push('size_MB conversion failed');
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  console.log('NCBI SRA RunInfo normalizer self-test passed.');
}
const args=process.argv.slice(2);
if(args.includes('--self-test')) selfTest();
else{
  const [input,output,sourceId,bioproject,retrievedAt]=args;
  if(!input||!output||!sourceId||!bioproject){
    console.error('Usage: node scripts/normalize-ncbi-sra-runinfo.mjs <runinfo.csv> <output.jsonl> <source-id> <bioproject> [retrieved-date]');
    process.exit(2);
  }
  const sourceUrl=`https://www.ncbi.nlm.nih.gov/bioproject/${bioproject.replace(/^PRJNA/,'')}`;
  const out=normalize(fs.readFileSync(input,'utf8'),{sourceId,bioproject,retrievedAt:retrievedAt||new Date().toISOString().slice(0,10),sourceUrl});
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,out.records.map(x=>JSON.stringify(x)).join('\n')+(out.records.length?'\n':''));
  fs.writeFileSync(output.replace(/\.jsonl$/,'')+'.quarantine.jsonl',out.quarantine.map(x=>JSON.stringify(x)).join('\n')+(out.quarantine.length?'\n':''));
  console.log(JSON.stringify({records:out.records.length,quarantine:out.quarantine.length,output},null,2));
}
