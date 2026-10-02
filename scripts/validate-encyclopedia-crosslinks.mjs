#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
const root=process.cwd(), enc=path.join(root,'content','encyclopedia');
const registry=JSON.parse(fs.readFileSync(path.join(enc,'current-controlled-registry.json'),'utf8'));
const valid=new Set((registry.entries||[]).map(x=>x.id));
const errors=[], warnings=[];
const seen=new Set();
for(const l of readCanonicalEncyclopediaLessons(root)){
 if(seen.has(l.id)) continue; seen.add(l.id);
 const raw=typeof l.crossLinks==='string'?l.crossLinks:JSON.stringify(l.crossLinks||'');
 const ids=[...new Set(raw.match(/THC-ENC-\d{3}/g)||[])];
 if(ids.includes(l.id)) errors.push(`${l.id}: cross-links to itself`);
 for(const id of ids) if(!valid.has(id)) errors.push(`${l.id}: cross-links to unknown lesson ${id}`);
 if(ids.length<2) warnings.push(`${l.id}: fewer than 2 explicit lesson cross-links`);
}
if(seen.size!==420) errors.push(`Expected 420 lessons, found ${seen.size}`);
if(errors.length){console.error('Cross-link validation failed:');errors.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log(`Encyclopedia cross-links PASS: ${seen.size} lessons; no self-links or unknown explicit lesson IDs. ${warnings.length} lessons have fewer than 2 explicit IDs and remain improvement candidates.`);
