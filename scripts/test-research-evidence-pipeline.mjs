#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from './build-research-evidence-index.mjs';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dtf-research-pipeline-'));
const csv=path.join(tmp,'grin.csv');
fs.writeFileSync(csv,'ACCESSION,PUID,PLANT NAME,TAXONOMY,ORIGIN,ht\nPI 1,PUID-1,Pipeline Example,Cannabis sativa L.,US,125.5\n');
const outDir=path.join(tmp,'imported/grin/normalized');
const run=spawnSync(process.execPath,['scripts/normalize-grin-hemp-export.mjs',csv,outDir,'https://example.test/grin.csv','2026-10-02'],{cwd:root,encoding:'utf8'});
if(run.status!==0) throw new Error('GRIN normalizer failed: '+run.stderr);
const index=build(path.join(tmp,'imported'),{requireRecords:true});
if(index.entries.length<2) throw new Error('expected germplasm + phenotype evidence records');
const germ=index.entries.find(x=>x.kind==='germplasm');
const pheno=index.entries.find(x=>x.kind==='phenotype');
if(!germ||!pheno) throw new Error('normalized records did not reach evidence index');
for(const e of [germ,pheno]){
 if(e.provenance.source_url!=='https://example.test/grin.csv'||e.provenance.retrieved_at!=='2026-10-02') throw new Error('provenance lost in normalization→index pipeline');
 if(e.use_policy.training!==false||e.use_policy.heldout_eval!==false||e.use_policy.direct_dtf_cultivar_inference!==false) throw new Error('unsafe evidence policy');
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log('research ingestion→evidence index integration: PASS');
