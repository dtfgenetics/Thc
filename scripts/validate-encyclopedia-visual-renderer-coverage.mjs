#!/usr/bin/env node
import fs from 'node:fs';

const queue=JSON.parse(fs.readFileSync('content/encyclopedia/visual-production-queue-v1.json','utf8'));
const renderer=fs.readFileSync('scripts/render-encyclopedia-visual-candidates.py','utf8');
const families=[...new Set((queue.items||[]).map(x=>x.visualFamily).filter(Boolean))].sort();
const mapped=[...renderer.matchAll(/'([^']+)':render_[a-z_]+/g)].map(m=>m[1]);
const supported=new Set(mapped);
const missing=families.filter(x=>!supported.has(x));
const errors=[];
if(!families.length)errors.push('Visual queue contains no visual families.');
if(missing.length)errors.push('Renderer is missing controlled families: '+missing.join(', '));
for(const family of families){
  const count=(queue.items||[]).filter(x=>x.visualFamily===family).length;
  if(count<1)errors.push('Visual family has zero queue items: '+family);
}
if(!renderer.includes("candidateOnly")||!renderer.includes("approvalEffect"))errors.push('Renderer must preserve candidate-only approval boundary metadata.');
if(errors.length){
  console.error('Encyclopedia visual renderer coverage failed:');
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('Encyclopedia visual renderer coverage PASS: '+families.length+' controlled families · '+families.join(', '));
