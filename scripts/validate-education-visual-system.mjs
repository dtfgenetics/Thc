#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const policyPath=path.join(root,'site/wordpress/visual-quality-policy.json');
const planPath=path.join(root,'site/wordpress/education/visual-reference-plan-v2.json');
const placementPath=path.join(root,'site/wordpress/education/approved-visual-placements-v1.json');
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
const placements=JSON.parse(fs.readFileSync(placementPath,'utf8'));
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
assert(placements.schemaVersion===1,'Approved visual placement registry must use schemaVersion 1');
assert(placements.policy?.exactSlugRequired===true,'Approved visual placement registry must require exact slugs');
assert(placements.policy?.keywordFallbackAllowed===false,'Approved visual placement registry must forbid keyword fallback');
let placementCount=0;
for(const id of topicIds){
  const slots=plan.topics[id];
  assert(Array.isArray(slots)&&slots.length>=4,`${id} must define at least four visual reference slots`);
  const registered=placements.topics?.[id]||[];
  assert(registered.length===slots.length,`${id}: placement registry must mirror all planned slots`);
  placementCount+=registered.length;
  for(const slot of slots||[]){
    assert(Array.isArray(slot)&&slot.length===3,`${id} contains an invalid visual slot`);
  }
  for(const entry of registered){
    assert(/^[-a-z0-9]+$/.test(String(entry.slotId||'')),`${id}: invalid slotId`);
    if(entry.status==='approved'){
      assert(String(entry.approvedMediaSlug||'').startsWith('dtf-approved-visual-'),`${entry.slotId}: approved placement must use dtf-approved-visual-* slug`);
      const checks=entry.approval||{};
      for(const check of placements.policy.requiredApprovalChecks||[]) assert(checks[check]===true,`${entry.slotId}: approved placement missing ${check} approval`);
      assert(String(entry.altText||'').length>=20,`${entry.slotId}: approved placement needs useful alt text`);
      assert(String(entry.caption||'').length>=20,`${entry.slotId}: approved placement needs useful caption`);
    } else {
      assert(entry.approvedMediaSlug===null,`${entry.slotId}: non-approved placement must not carry a public media slug`);
    }
  }
}
assert(placementCount===48,`Expected 48 exact visual-placement records; found ${placementCount}`);

const banned=(policy.bannedHtml?.urlContains||[]).filter(Boolean);
for(const token of banned){
  if(library.includes(token)) errors.push(`visual library still references quarantined visual: ${token}`);
}

for(const p of mapPaths){
  const label=path.relative(root,p);
  const data=JSON.parse(fs.readFileSync(p,'utf8'));
  const active=[];
  if(data.chapters){
    for(const visuals of Object.values(data.chapters)){
      if(Array.isArray(visuals)) active.push(...visuals);
    }
  }
  if(Array.isArray(data.visuals)) active.push(...data.visuals);
  for(const visual of active){
    const file=String(visual?.file||'');
    for(const token of banned){
      if(file.includes(token)) errors.push(`${label} still actively references quarantined visual: ${token}`);
    }
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
console.log('Education visual system valid: quarantined references removed, 12 subject families and 48 exact role-specific placement records defined, keyword fallback forbidden, approved-only library preserved.');
