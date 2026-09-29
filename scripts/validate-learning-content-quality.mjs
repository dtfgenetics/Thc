#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const file=path.join(root,'site/wordpress/education/topic-literature.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
const warn=[];
const assert=(ok,msg)=>{if(!ok)errors.push(msg)};

assert(data.schemaVersion>=3,'topic-literature schemaVersion must be at least 3');
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
  assert(Array.isArray(topic.references)&&topic.references.length>=2,`${topic.id}: needs at least two supporting references`);
  assert(Array.isArray(topic.referenceGuide?.observe)&&topic.referenceGuide.observe.length>=3,`${topic.id}: field guide needs at least 3 observation prompts`);
  assert(Array.isArray(topic.referenceGuide?.measure)&&topic.referenceGuide.measure.length>=3,`${topic.id}: field guide needs at least 3 measurement prompts`);
  assert(Array.isArray(topic.referenceGuide?.avoid)&&topic.referenceGuide.avoid.length>=2,`${topic.id}: field guide needs at least 2 inference cautions`);

  const journey=topic.learnerJourney||{};
  assert(String(journey.quickAnswer||'').length>=120,`${topic.id}: learner journey needs a substantive quick answer`);
  assert(Array.isArray(journey.observe)&&journey.observe.length>=4,`${topic.id}: learner journey needs at least 4 observation prompts`);
  assert(Array.isArray(journey.measure)&&journey.measure.length>=4,`${topic.id}: learner journey needs at least 4 measurement prompts`);
  assert(Array.isArray(journey.decide)&&journey.decide.length>=4,`${topic.id}: learner journey needs at least 4 decision rules`);
  assert(String(journey.verify||'').length>=80,`${topic.id}: learner journey needs a verification rule`);
  assert(Array.isArray(journey.linkedTools)&&journey.linkedTools.length>=2,`${topic.id}: learner journey needs at least 2 linked tools/resources`);
  assert(Array.isArray(journey.visualRoles)&&journey.visualRoles.length>=3,`${topic.id}: learner journey needs at least 3 purposeful visual roles`);
  assert(String(journey.evidenceBoundary||'').length>=100,`${topic.id}: learner journey needs an evidence boundary`);
  for(const href of journey.linkedTools||[]) assert(/^\//.test(href),`${topic.id}: linked tool/resource must use a site-relative route: ${href}`);
  assert(Array.isArray(topic.practiceScenarios)&&topic.practiceScenarios.length>=2,`${topic.id}: needs at least two applied practice scenarios`);
  for(const scenario of topic.practiceScenarios||[]){
    assert(String(scenario.title||'').length>=6,`${topic.id}: practice scenario missing title`);
    assert(String(scenario.prompt||'').length>=80,`${topic.id}: practice scenario prompt is too thin`);
    assert(Array.isArray(scenario.evidenceToCollect)&&scenario.evidenceToCollect.length>=4,`${topic.id}: practice scenario needs at least four evidence items`);
    assert(String(scenario.successCheck||'').length>=80,`${topic.id}: practice scenario needs a success check`);
  }

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
console.log(`Learning content quality valid: ${data.topics.length} topic pages meet depth, evidence, practice-scenario, field-guide, decision-journey, tool-link, visual-role, and reference coverage.`);
