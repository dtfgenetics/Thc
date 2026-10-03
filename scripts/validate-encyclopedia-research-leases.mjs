#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),qPath=path.join(root,'data','encyclopedia-research-work-queue.json'),lPath=path.join(root,'content','encyclopedia','evidence','research-work-leases.json');
const errors=[];if(!fs.existsSync(qPath)){console.error('Missing generated research queue; run npm run build:encyclopedia-research-queue first.');process.exit(1)}
const q=JSON.parse(fs.readFileSync(qPath,'utf8')),r=JSON.parse(fs.readFileSync(lPath,'utf8'));const known=new Set((q.workUnits||[]).map(x=>x.workUnitId)),active=new Map(),allowed=new Set(['reviewed_claim_binding','documented_limitation','no_source_decision']);
for(const [i,l] of (r.leases||[]).entries()){const p=`leases[${i}]`;if(!known.has(l.workUnitId))errors.push(`${p}: unknown workUnitId ${l.workUnitId}`);if(!l.owner||!String(l.owner).trim())errors.push(`${p}: owner required`);if(!['active','completed','released'].includes(l.status))errors.push(`${p}: invalid status`);
 if(l.status==='active'){if(!l.expiresAt||Number.isNaN(Date.parse(l.expiresAt)))errors.push(`${p}: valid expiresAt required`);else if(Date.parse(l.expiresAt)>Date.now()){if(active.has(l.workUnitId))errors.push(`${p}: duplicate active lease; also owned by ${active.get(l.workUnitId)}`);active.set(l.workUnitId,l.owner)}}
 if(l.status==='completed'){if(!allowed.has(l.outcome?.type))errors.push(`${p}: completed lease requires allowed outcome.type`);if(!l.outcome?.reference||!String(l.outcome.reference).trim())errors.push(`${p}: completed lease requires outcome.reference`);}}
if(errors.length){console.error(`Research lease validation failed with ${errors.length} error(s):`);for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log(`Research lease registry PASS: ${(r.leases||[]).length} records; ${active.size} active non-expired leases.`);
