#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const file=path.join(process.cwd(),'data/research/generated/research-evidence-index-v1.json');
if(!fs.existsSync(file)){console.log('research evidence index: no generated artifact yet (PASS)');process.exit(0)}
const d=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
if(d.schema_version!=='dtf-research-evidence-index-v1') errors.push('wrong schema_version');
if(d.policy?.training_eligible!==false||d.policy?.heldout_eval_eligible!==false||d.policy?.dtf_cultivar_inference!==false) errors.push('unsafe top-level evidence policy');
const seen=new Set();
for(const [i,e] of (d.entries||[]).entries()){
 if(!e.evidence_id||seen.has(e.evidence_id)) errors.push(`entry ${i}: missing/duplicate evidence_id`); seen.add(e.evidence_id);
 if(!e.source_id||!e.record_id||!e.provenance?.source_url||!e.provenance?.retrieved_at) errors.push(`entry ${i}: incomplete provenance`);
 if(e.use_policy?.retrieval!==true||e.use_policy?.training!==false||e.use_policy?.heldout_eval!==false||e.use_policy?.direct_dtf_cultivar_inference!==false) errors.push(`entry ${i}: unsafe use_policy`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`research evidence index validation: PASS (${d.entries.length} records)`);
