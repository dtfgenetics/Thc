#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const registryPath='content/encyclopedia/current-controlled-registry.json';
const out=process.argv[2]||'site/wordpress/education/encyclopedia/full-controlled-catalog.json';
const registry=JSON.parse(await readFile(registryPath,'utf8'));
const entries=Array.isArray(registry.entries)?registry.entries:[];
if(entries.length!==420) throw new Error(`Expected 420 controlled entries; found ${entries.length}`);

const lessonFiles=[];
const seen=new Set();
for(const entry of entries){
  if(!/^THC-ENC-\d{3}$/.test(entry.id)) throw new Error(`Invalid controlled ID: ${entry.id}`);
  if(seen.has(entry.id)) throw new Error(`Duplicate controlled ID: ${entry.id}`);
  seen.add(entry.id);
  const part=String(entry.part).padStart(2,'0');
  const num=String(entry.number).padStart(3,'0');
  const file=`content/encyclopedia/volume-${part}/lessons/thc-enc-${num}.json`;
  const lesson=JSON.parse(await readFile(file,'utf8'));
  if(lesson.id!==entry.id) throw new Error(`Registry/file mismatch: ${entry.id} -> ${lesson.id} in ${file}`);
  if(lesson.reviewControl?.publicationAuthorized===false) throw new Error(`${entry.id} is explicitly blocked from publication`);
  lessonFiles.push(file);
}
const manifest={
  schemaVersion:1,
  batch:'full-controlled-catalog-420',
  status:'owner_authorized_external_review_pending',
  publicationAuthorized:true,
  validationGate:'full-catalog-v1',
  source:{
    controlledCatalogueVersion:'Master Content Map v1.1',
    version:'THC Encyclopedia — Full Controlled 420-Lesson Catalog',
    publicationAuthorization:'Project owner authorized completion and publication of the Encyclopedia. Independent specialist approval remains a separate project-control field and is not implied by website publication.',
    note:'Generated from content/encyclopedia/current-controlled-registry.json; preserves permanent THC-ENC-001–420 identities.'
  },
  lessonFiles
};
await mkdir(path.dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${out} with ${lessonFiles.length} controlled lessons.`);
