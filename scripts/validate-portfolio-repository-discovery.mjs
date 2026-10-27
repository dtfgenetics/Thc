#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const portfolio=JSON.parse(readFileSync(resolve(root,'data/portfolio-repository-discovery.json'),'utf8'));
const ownership=JSON.parse(readFileSync(resolve(root,'data/tool-execution-registry.json'),'utf8'));
const err=[];const seen=new Set();
if(portfolio.schema_version!==1)err.push('Invalid schema');
if(!Array.isArray(portfolio.repositories))err.push('Repositories must be an array');
for(const r of portfolio.repositories||[]){
 if(!/^dtfgenetics\/[A-Za-z0-9_.-]+$/.test(r.full_name))err.push('Invalid repository: '+r.full_name);
 if(seen.has(r.full_name))err.push('Duplicate repository: '+r.full_name);
 seen.add(r.full_name);
 if(!r.role||!r.evidence)err.push('Missing role/evidence: '+r.full_name);
}
for(const t of ownership.tools){
 if(!seen.has(t.canonical.repo))err.push('Canonical tool owner missing from portfolio: '+t.canonical.repo);
}
for(const [role,name] of Object.entries({academy:'dtfgenetics/Thc-learning-courses-',media:'dtfgenetics/Video-photo-editing-and-communications-posting-'})){
 if(!seen.has(name))err.push(role+' repo missing: '+name);
}
if(err.length){err.forEach(e=>console.error('ERROR '+e));process.exit(1);}
const unresolved=portfolio.repositories.filter(x=>x.role==='requires-ownership-review');
console.log(JSON.stringify({total:portfolio.repositories.length,classified:portfolio.repositories.length-unresolved.length,needs_review:unresolved.map(x=>x.full_name)},null,2));
