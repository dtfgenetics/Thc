#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const policyPath=path.join(root,'site/wordpress/visual-quality-policy.json');
const planPath=path.join(root,'site/wordpress/education/visual-reference-plan-v2.json');
const libraryPath=path.join(root,'site/public-route-patch/learn/infographics/index.html');
const mapPaths=[
  'site/wordpress/education/nutrition-media-v6-visual-map.json',
  'site/wordpress/education/plant-health-ipm-v6-visual-map.json',
  'site/wordpress/education/lifecycle-propagation-v6-visual-map.json',
  'site/wordpress/education/environment-vpd-v6-visual-map.json',
  'site/wordpress/education/plant-biology-v6-visual-map.json',
  'site/wordpress/education/training-canopy-v6-visual-map.json',
  'site/wordpress/education/harvest-postharvest-v6-visual-map.json',
].map(p=>path.join(root,p));

const policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
const library=fs.readFileSync(libraryPath,'utf8');
const errors=[];

const assert=(cond,msg)=>{if(!cond)errors.push(msg)};
assert(policy.mode==='quarantine','Visual quality policy must remain in quarantine mode');
assert(policy.replacementPolicy?.automaticKeywordMediaSelectionAllowed===false,'Automatic keyword media selection must remain disabled');
assert(policy.replacementPolicy?.legacyInfographicReuseAllowed===false,'Legacy infographic reuse must remain disabled');
assert(plan.schemaVersion===2,'Visual reference plan must use schemaVersion 2');
assert(plan.policy?.rasterPreferred===true,'Visual reference plan must prefer raster assets');
assert(plan.policy?.svgInstructionalAssetsAllowed===false,'Instructional SVG production must remain disabled');
assert(Number(plan.policy?.minimumRasterWidthPx)>=1800,'Visual production minimum width must be at least 1800px');

const topicIds=Object.keys(plan.topics||{});
assert(topicIds.length===12,`Visual reference plan must define 12 subject families; found ${topicIds.length}`);
for(const id of topicIds){
  const slots=plan.topics[id];
  assert(Array.isArray(slots)&&slots.length>=4,`${id} must define at least four visual reference slots`);
  for(const slot of slots||[]){
    assert(Array.isArray(slot)&&slot.length===3,`${id} contains an invalid visual slot`);
  }
}

const banned=(policy.bannedHtml?.urlContains||[]).filter(Boolean);
const scanned=[['visual library',library],...mapPaths.map(p=>[path.relative(root,p),fs.readFileSync(p,'utf8')])];
for(const [label,text] of scanned){
  for(const token of banned){
    if(text.includes(token)) errors.push(`${label} still references quarantined visual: ${token}`);
  }
}
assert(library.includes('48 core reference slots'),'Visual library must expose the 48-slot production model');
assert(library.includes('Reference image, not decoration.'),'Visual library must expose the new production standard');
assert(!/<img\b/i.test(library),'Static visual library must not reintroduce unapproved images');

if(errors.length){
  console.error(`Education visual-system validation failed with ${errors.length} issue(s):`);
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Education visual system valid: quarantined references removed, 12 subject families and 48 role-specific replacement slots defined, approved-only library preserved.');
