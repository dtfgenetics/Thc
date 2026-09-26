#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const file=path.join(root,'site/wordpress/education/topic-literature.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
const warn=[];
const assert=(ok,msg)=>{if(!ok)errors.push(msg)};

assert(Array.isArray(data.topics),'topic-literature topics must be an array');
assert((data.topics||[]).length>=13,`Expected at least 13 topic pages; found ${data.topics?.length||0}`);

const ids=new Set();
for(const topic of data.topics||[]){
  assert(topic.id && !ids.has(topic.id),`Duplicate or missing topic id: ${topic.id||'(missing)'}`);
  ids.add(topic.id);
  const sections=topic.sections||[];
  const paragraphs=sections.reduce((n,s)=>n+(s.paragraphs||[]).length,0);
  const checkpoints=sections.reduce((n,s)=>n+(s.checkpoints||[]).length,0);
  assert(sections.length>=8,`${topic.id}: needs at least 8 core sections; found ${sections.length}`);
  assert(paragraphs>=16,`${topic.id}: needs at least 16 substantive paragraphs; found ${paragraphs}`);
  assert(checkpoints>=24,`${topic.id}: needs at least 24 practical checkpoints; found ${checkpoints}`);
  assert(String(topic.summary||'').length>=120,`${topic.id}: summary is too thin`);
  assert(Array.isArray(topic.references)&&topic.references.length>=1,`${topic.id}: needs at least one supporting reference`);
  assert(Array.isArray(topic.referenceGuide?.observe)&&topic.referenceGuide.observe.length>=3,`${topic.id}: field guide needs at least 3 observation prompts`);
  assert(Array.isArray(topic.referenceGuide?.measure)&&topic.referenceGuide.measure.length>=3,`${topic.id}: field guide needs at least 3 measurement prompts`);
  assert(Array.isArray(topic.referenceGuide?.avoid)&&topic.referenceGuide.avoid.length>=2,`${topic.id}: field guide needs at least 2 inference cautions`);
  for(const ref of topic.references||[]){
    assert(String(ref.title||'').length>4,`${topic.id}: reference missing title`);
    assert(ref.organization||ref.doi||ref.url,`${topic.id}: reference ${ref.title||'(untitled)'} lacks organization, DOI, or URL context`);
  }
}

for(const id of ['plant-biology','lighting','nutrition-media','plant-health-ipm','harvest-postharvest']){
  const topic=(data.topics||[]).find(t=>t.id===id);
  assert(topic && topic.references.length>=2,`${id}: foundation topic should expose at least two references`);
  if(topic && !topic.references.some(r=>r.url)) warn.push(`${id}: no clickable source URL yet`);
}

if(errors.length){
  console.error(`Learning content quality validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
if(warn.length){
  console.warn('Learning content quality warnings:');
  for(const w of warn) console.warn(' - '+w);
}
console.log(`Learning content quality valid: ${data.topics.length} topic pages meet minimum section, paragraph, checkpoint, field-guide, and reference coverage.`);
