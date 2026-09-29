#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'scripts/rebuild-wordpress-learning-experience-v3.mjs'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/topic-literature.json'),'utf8'));
const errors=[];
const assert=(ok,msg)=>{if(!ok)errors.push(msg)};

assert(data.schemaVersion>=2,'topic literature must remain schemaVersion 2+');
for(const token of [
  'topic.learnerJourney',
  'journey.quickAnswer',
  "journeyList('Observe'",
  "journeyList('Measure'",
  "journeyList('Decide'",
  'journey.verify',
  'journey.evidenceBoundary',
  'journey.linkedTools',
  'journey.visualRoles',
  'Decision-first learning',
  'How to know the decision worked',
  'Four ways into one knowledge system',
  'By stage',
  'By problem',
  'By system',
  'By skill',
  'Every strong lesson should answer eight questions'
]) assert(source.includes(token),`Learning V3 canonical renderer is missing required decision-first token: ${token}`);

for(const topic of data.topics||[]){
  const j=topic.learnerJourney||{};
  assert(String(j.quickAnswer||'').length>=120,`${topic.id}: quickAnswer missing/thin`);
  assert((j.observe||[]).length>=4,`${topic.id}: observe layer missing`);
  assert((j.measure||[]).length>=4,`${topic.id}: measure layer missing`);
  assert((j.decide||[]).length>=4,`${topic.id}: decide layer missing`);
  assert(String(j.verify||'').length>=80,`${topic.id}: verify layer missing/thin`);
  assert((j.visualRoles||[]).length>=3,`${topic.id}: purposeful visual roles missing`);
  assert((j.linkedTools||[]).length>=2,`${topic.id}: related tool/resource links missing`);
  assert(String(j.evidenceBoundary||'').length>=100,`${topic.id}: evidence boundary missing/thin`);
}

if(errors.length){
  console.error(`Learning V3 decision-renderer validation failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Learning V3 decision renderer PASS: ${data.topics.length} topics render quick-answer, observe, measure, decide, verify, visuals, tools, and evidence boundaries.`);
