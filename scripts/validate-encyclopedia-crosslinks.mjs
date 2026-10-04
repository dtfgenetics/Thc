#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), enc=path.join(root,'content','encyclopedia');
const { loadEncyclopediaRegistry } = await import('./lib/encyclopedia-registry.mjs');
const registryState=loadEncyclopediaRegistry(root);
const valid=new Set(registryState.entries.map(x=>x.id));
const errors=[], warnings=[];
function lessons(){
 const out=[];
 const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.json')){let j;try{j=JSON.parse(fs.readFileSync(p,'utf8'))}catch{continue};if(/^THC-ENC-\d{3,}$/.test(j.id||''))out.push(j);for(const x of Array.isArray(j.lessons)?j.lessons:[])if(/^THC-ENC-\d{3,}$/.test(x.id||''))out.push(x)}}};walk(enc);return out;
}
const seen=new Set();
for(const l of lessons()){
 if(seen.has(l.id)) continue; seen.add(l.id);
 const raw=typeof l.crossLinks==='string'?l.crossLinks:JSON.stringify(l.crossLinks||'');
 const ids=[...new Set(raw.match(/THC-ENC-\d{3,}/g)||[])];
 if(ids.includes(l.id)) errors.push(`${l.id}: cross-links to itself`);
 for(const id of ids) if(!valid.has(id)) errors.push(`${l.id}: cross-links to unknown lesson ${id}`);
 if(ids.length<2) warnings.push(`${l.id}: fewer than 2 explicit lesson cross-links`);
}
if(seen.size!==registryState.totalCount) errors.push(`Expected ${registryState.totalCount} registered lessons, found ${seen.size}`);
if(errors.length){console.error('Cross-link validation failed:');errors.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log(`Encyclopedia cross-links PASS: ${seen.size} lessons; no self-links or unknown explicit lesson IDs. ${warnings.length} lessons have fewer than 2 explicit IDs and remain improvement candidates.`);
