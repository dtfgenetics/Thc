#!/usr/bin/env node
import fs from 'node:fs';

const target=JSON.parse(fs.readFileSync('site/wordpress/education/academy-deployment-target.json','utf8'));
const configs=[
  'site/wordpress/education/learning-hub-course1.json',
  'site/wordpress/education/tech1-courses-public-v1.json',
  'site/wordpress/education/tech2-courses-public-v1.json'
];
const errors=[];

if(target.sourceRepository!=='dtfgenetics/Thc-learning-courses-') errors.push('academy deployment target repository mismatch');
if(!/^[0-9a-f]{40}$/.test(target.sourceSha||'')) errors.push('academy deployment target must use a full lowercase SHA');

for(const file of configs){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.source?.repository!==target.sourceRepository) errors.push(`${file}: source.repository must match academy deployment target`);
  if(data.source?.ref!==target.sourceSha) errors.push(`${file}: source.ref ${data.source?.ref||'<missing>'} must equal pinned academy source ${target.sourceSha}`);
  if(data.source?.ref==='main') errors.push(`${file}: production source ref must not float on main`);
}

for(const file of [
  'scripts/publish-wordpress-learning-hub-course1-v2.mjs',
  'scripts/sync-wordpress-learning-hub-course1-visuals.mjs',
  'scripts/enhance-wordpress-learning-hub-course1-ui-v3.mjs',
  'scripts/publish-wordpress-tech1-courses-2-7-v2.mjs',
  'scripts/verify-wordpress-tech1-courses-2-7-v2.mjs',
  'scripts/publish-wordpress-tech2-courses-1-8.mjs',
  'scripts/verify-wordpress-learning-hub-course1.mjs'
]){
  const src=fs.readFileSync(file,'utf8');
  if(!src.includes('THC_LEARNING_SOURCE_SHA')) errors.push(`${file}: must honor THC_LEARNING_SOURCE_SHA`);
  if(!src.includes('raw.githubusercontent.com')) errors.push(`${file}: expected pinned raw-source fetch contract`);
}

if(errors.length){
  console.error(`Academy source-pin validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Academy source pin valid: all production course configs and publishers resolve dtfgenetics/Thc-learning-courses-@${target.sourceSha}.`);
