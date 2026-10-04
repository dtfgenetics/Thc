#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { discoverEncyclopediaVolumes } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const enc=path.join(root,'content','encyclopedia');
const out=path.join(enc,'catalog.json');
const check=process.argv.includes('--check');
const pad=n=>String(n).padStart(2,'0');

const volumes=[];
for(const volumeInfo of discoverEncyclopediaVolumes(root)){
  const n=volumeInfo.number;
  const rel=`content/encyclopedia/${volumeInfo.name}/manifest.json`;
  const file=path.join(root,rel);
  if(!fs.existsSync(file)) throw new Error(`Missing encyclopedia manifest: ${rel}`);
  const m=JSON.parse(fs.readFileSync(file,'utf8'));
  if(Number(m.number)!==n) throw new Error(`Volume ${n} manifest number mismatch: ${m.number}`);
  const expectedId=`THC-ENC-V${pad(n)}`;
  if((m.volumeId||expectedId)!==expectedId) throw new Error(`Volume ${n} id mismatch: ${m.volumeId}`);
  if(m.catalogRegistration==='withheld_until_review_gate') continue;
  if(!m.title||!m.route) throw new Error(`Volume ${n} is publishable but lacks title or route`);
  volumes.push({id:expectedId,number:n,title:m.title,path:rel,route:m.route});
}
const output={
  schemaVersion:'1.2.0',
  generatedFrom:'content/encyclopedia/volume-*/manifest.json',
  generationRule:'Discover every volume directory and include each source volume whose catalogRegistration is not withheld_until_review_gate.',
  volumes
};
const serialized=JSON.stringify(output,null,2)+'\n';
if(check){
  const current=fs.existsSync(out)?fs.readFileSync(out,'utf8'):'';
  if(current!==serialized){
    console.error('Encyclopedia catalog is stale. Run: npm run build:encyclopedia-catalog');
    process.exit(1);
  }
  console.log(`Encyclopedia catalog PASS: ${volumes.length} discovered publishable volumes.`);
}else{
  fs.writeFileSync(out,serialized);
  console.log(`Wrote ${path.relative(root,out)} with ${volumes.length} publishable volumes.`);
}
