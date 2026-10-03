#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const enc=path.join(root,'content','encyclopedia');
const failures=[];
const banned=[
  'A label, generation name, or single phenotype does not establish genetic value by itself',
  'The claim should not be generalized beyond the tested population, parents, environments, and measurement methods without additional validation',
  'State the evidence supporting advancement, note uncertainty and correlated tradeoffs',
  'Correction: See the lesson evidence and context'
];
const fields=['objective','coreScience','cultivationRelevance','measureAndRecord','misconceptions','evidenceLimits'];
const text=v=>{
  if(Array.isArray(v)) return v.map(text).join(' ');
  if(v&&typeof v==='object') return Object.values(v).map(text).join(' ');
  return String(v??'');
};

for(let part=1;part<=21;part++){
  const dir=path.join(enc,`volume-${String(part).padStart(2,'0')}`,'lessons');
  if(!fs.existsSync(dir)) continue;
  for(const name of fs.readdirSync(dir).filter(x=>/^thc-enc-\d{3}\.json$/.test(x)).sort()){
    const file=path.join(dir,name);
    const lesson=JSON.parse(fs.readFileSync(file,'utf8'));
    const body=fields.map(f=>text(lesson[f])).join(' ');
    for(const phrase of banned){
      if(body.includes(phrase)) failures.push(`${lesson.id}: banned generic copy: "${phrase}"`);
    }
    if(/\.{2,}(?=\s|["'])/.test(body)) failures.push(`${lesson.id}: repeated period punctuation found`);
    for(const field of ['measureAndRecord','misconceptions','evidenceLimits']){
      const rows=Array.isArray(lesson[field])?lesson[field]:[];
      if(rows.some(x=>String(x).trim().length<35)) failures.push(`${lesson.id}: ${field} contains a thin entry`);
    }
  }
}

if(failures.length){
  console.error(`Encyclopedia copy-quality validation failed with ${failures.length} finding(s):`);
  failures.slice(0,200).forEach(x=>console.error(' - '+x));
  if(failures.length>200) console.error(` - ...and ${failures.length-200} more`);
  process.exit(1);
}
console.log('Encyclopedia copy-quality PASS: no banned boilerplate, doubled periods, or thin critical entries found.');
