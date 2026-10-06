#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export function validateAcceptanceManifests(doc,{root=process.cwd(),checkSources=true}={}){
 const errors=[];
 if(doc?.schemaVersion!==1) errors.push('schemaVersion must be 1');
 if(!doc?.manifestId) errors.push('manifestId required');
 if(!Array.isArray(doc?.domains)||!doc.domains.length) errors.push('domains required');
 const ids=new Set();
 for(const [i,d] of (doc?.domains||[]).entries()){
  const p='domains['+i+']';
  if(!d.id) errors.push(p+' missing id');
  else if(ids.has(d.id)) errors.push('duplicate domain '+d.id);
  else ids.add(d.id);
  if(!d.projectType) errors.push(p+' missing projectType');
  if(!Array.isArray(d.sources)||!d.sources.length) errors.push(p+' missing sources');
  if(!Array.isArray(d.validators)||!d.validators.length) errors.push(p+' missing validators');
  if(typeof d.liveRequired!=='boolean') errors.push(p+' liveRequired must be boolean');
  if(checkSources) for(const source of d.sources||[]){
   if(typeof source!=='string'||!source.trim()) errors.push(p+' invalid source');
   else if(!fs.existsSync(path.join(root,source))) errors.push(p+' missing source '+source);
  }
 }
 return errors;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const file=process.argv[2]||'data/project-os/acceptance-manifests.json';
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 const errors=validateAcceptanceManifests(doc);
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS acceptance manifests valid: '+doc.domains.length+' domain(s)');
}
