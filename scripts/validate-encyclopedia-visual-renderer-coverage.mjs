#!/usr/bin/env node
import fs from 'node:fs';

const queue=JSON.parse(fs.readFileSync('content/encyclopedia/visual-production-queue-v1.json','utf8'));
const renderer=fs.readFileSync('scripts/render-encyclopedia-visual-candidates.py','utf8');
const families=[...new Set((queue.items||[]).map(x=>x.visualFamily).filter(Boolean))].sort();
const mapped=[...renderer.matchAll(/'([^']+)':render_[a-z_]+/g)].map(m=>m[1]);
const requiredRoles=['core-concept-overview','labeled-anatomy-or-structure','mechanism-or-process-sequence','measurement-or-data-reference','comparison-or-contrast','diagnostic-or-observation-example','environment-or-cultivation-context','microscopy-or-detail-view','misconception-correction','summary-reference-graphic'];
const supported=new Set(mapped);
const missing=families.filter(x=>!supported.has(x));
const errors=[];
if(!families.length)errors.push('Visual queue contains no visual families.');
if(missing.length)errors.push('Renderer is missing controlled families: '+missing.join(', '));
const missingRoles=requiredRoles.filter(role=>!renderer.includes(`'${role}':render_`));
if(missingRoles.length)errors.push('Renderer is missing controlled teaching roles: '+missingRoles.join(', '));
for(const family of families){
  const count=(queue.items||[]).filter(x=>x.visualFamily===family).length;
  if(count<1)errors.push('Visual family has zero queue items: '+family);
}
if(!renderer.includes("candidateOnly")||!renderer.includes("approvalEffect"))errors.push('Renderer must preserve candidate-only approval boundary metadata.');
if(!renderer.includes("visualRoles")||!renderer.includes("visualRole")||!renderer.includes("visualOrdinal"))errors.push('Renderer must consume role-level visual tasks.');
if(!renderer.includes('role_renderers')||!renderer.includes("role_renderers.get(item.get('visualRole'))"))errors.push('Renderer must dispatch by teaching role before lesson visual family.');
for(const fn of ['render_overview','render_microscopy','render_misconception','render_summary']) if(!renderer.includes(`def ${fn}(`)) errors.push(`Renderer missing dedicated role composition: ${fn}`);
if(!renderer.includes("{item['lessonId']}_{int(item['visualOrdinal']):02d}_{item['visualRole']}.png"))errors.push('Renderer must emit controlled role-addressed PNG filenames.');
const roleTaskCount=(queue.items||[]).reduce((sum,item)=>sum+(item.visualRoles||[]).filter(role=>role.status==='brief_ready_raster_artwork_needed').length,0);
if(queue.summary?.visualTasksNeeded!==roleTaskCount)errors.push(`Queue visualTasksNeeded must equal role-level missing task count ${roleTaskCount}.`);
if(queue.summary?.targetVisualsPerLesson!==10||queue.summary?.minimumVisualsPerLesson!==8)errors.push('Renderer coverage requires the 8-minimum/10-target visual-depth contract.');
if(errors.length){
  console.error('Encyclopedia visual renderer coverage failed:');
  errors.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('Encyclopedia visual renderer coverage PASS: '+families.length+' controlled families · 10 controlled teaching roles · '+families.join(', '));
