#!/usr/bin/env node
import fs from 'node:fs';

export const REQUIRED_TYPES=["web_page","tool_calculator","game","dataset","encyclopedia_lesson","academy_certification","growlens_diagnostic","visual_asset","release_infrastructure"];

export function validateDefinitionsOfDone(doc){
 const errors=[];
 if(doc?.schemaVersion!==1) errors.push('schemaVersion must be 1');
 if(!doc?.manifestId) errors.push('manifestId required');
 if(!Array.isArray(doc?.requiredProjectTypes)) errors.push('requiredProjectTypes must be an array');
 const types=doc?.projectTypes||{};
 for(const type of REQUIRED_TYPES){
  if(!doc?.requiredProjectTypes?.includes(type)) errors.push('requiredProjectTypes missing '+type);
  const def=types[type];
  if(!def){errors.push('missing project type '+type);continue;}
  if(!def.description) errors.push(type+' missing description');
  if(!Array.isArray(def.criteria)||!def.criteria.length){errors.push(type+' missing criteria');continue;}
  const ids=new Set();
  for(const [i,c] of def.criteria.entries()){
   const p=type+'.criteria['+i+']';
   if(!c.id) errors.push(p+' missing id');
   else if(ids.has(c.id)) errors.push(type+' duplicate criterion '+c.id);
   else ids.add(c.id);
   if(!c.description) errors.push(p+' missing description');
   if(!Array.isArray(c.evidence)||!c.evidence.length) errors.push(p+' missing evidence requirements');
   else if(c.evidence.some(x=>typeof x!=='string'||!x.trim())) errors.push(p+' has invalid evidence key');
   if(c.conditional!==undefined&&(typeof c.conditional!=='string'||!c.conditional.trim())) errors.push(p+' invalid conditional');
  }
 }
 for(const type of Object.keys(types)) if(!doc.requiredProjectTypes?.includes(type)) errors.push('undeclared project type '+type);
 return errors;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const file=process.argv[2]||'data/project-os/definitions-of-done.json';
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));
 const errors=validateDefinitionsOfDone(doc);
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS Definitions of Done valid: '+Object.keys(doc.projectTypes).length+' project type(s)');
}
