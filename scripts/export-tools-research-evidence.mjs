import fs from 'node:fs';
import path from 'node:path';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath){console.error('Usage: node scripts/export-tools-research-evidence.mjs <run-batch.json> <output.json>');process.exit(2);}
const src=JSON.parse(fs.readFileSync(inputPath,'utf8'));
if(!Array.isArray(src.records)||!src.records.length)throw new Error('run batch records are required');
const retrieved=[...new Set(src.records.map(r=>r?.provenance?.retrieved_at).filter(Boolean))];
if(retrieved.length!==1)throw new Error('run batch must have one authoritative retrieval date');
const generatedAt=new Date(retrieved[0]+'T00:00:00Z').toISOString();
const sourceId='ncbi:'+src.bioproject;
const dataset={schema:'thc-research-evidence-dataset',version:1,datasetId:'ncbi-sra-'+String(src.bioproject).toLowerCase()+'-v1',generatedAt,sources:[{sourceId,provider:'NCBI SRA',retrievedAt:generatedAt,identifiers:{bioproject:src.bioproject,study_accession:src.study_accession},provenance:{acquisition:'Run Selector / RunInfo',source_id:src.source_id}}],records:src.records.map(r=>({recordId:'ncbi-sra:'+r.run_accession,kind:'genomics-run',sourceId,identifiers:{bioproject:r.bioproject,study_accession:r.study_accession,experiment_accession:r.experiment_accession,run_accession:r.run_accession,biosample:r.biosample,sra_sample_accession:r.sra_sample_accession},facts:{organism:r.organism,library_strategy:r.library_strategy,library_source:r.library_source,library_selection:r.library_selection,platform:r.platform,instrument:r.instrument,layout:r.layout,spots:{value:r.spots,unit:'count'},sample_name:r.sample_name,reported_bases:r.attributes?.reported_bases??null,reported_download_size:r.attributes?.reported_download_size??null},provenance:{source_url:r.provenance?.source_url,source_record_id:r.provenance?.source_record_id}}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(dataset,null,2)+'\n');console.log('exported '+dataset.records.length+' research evidence records to '+outputPath);
