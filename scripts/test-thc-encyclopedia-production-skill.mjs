import assert from 'node:assert/strict';
import fs from 'node:fs';

const skillPath='.agents/skills/thc-encyclopedia-production/SKILL.md';
const referencePath='.agents/skills/thc-encyclopedia-production/references/search-and-knowledge-system-patterns.md';
assert.ok(fs.existsSync(skillPath),'THC encyclopedia production skill must exist');
assert.ok(fs.existsSync(referencePath),'THC encyclopedia search-pattern reference must exist');
const skill=fs.readFileSync(skillPath,'utf8');

for(const marker of [
  'THC-ENC-421+',
  'current-controlled-registry.json',
  'build:encyclopedia-scorecard',
  'build:encyclopedia-discovery',
  'verify:encyclopedia-content-strict',
  'publication authorization',
  'search/discovery',
  'related tools',
  'live verification',
  'Permanent identity contract',
  'Expansion gate',
  '8 completed role-addressed visuals as the minimum depth gate',
  '10 as the production target',
  'core-concept overview',
  'labeled anatomy or structure',
  'mechanism or process sequence',
  'measurement or data reference',
  'comparison or contrast',
  'diagnostic or observation example',
  'environment or cultivation context',
  'microscopy or detail view',
  'misconception correction',
  'summary reference graphic',
  'Generated or discovered artwork remains **review-pending**',
  'verify:encyclopedia-visual-depth',
  'verify:encyclopedia-visual-renderer-coverage'
]){
  assert.ok(skill.includes(marker),`skill missing required contract marker: ${marker}`);
}
assert.match(skill,/repeatable production system/i);
assert.match(skill,/Never recycle or renumber/i);
assert.match(skill,/provider-independent/i);
assert.match(skill,/3,360 visuals minimum and 4,200 target visuals/i);
assert.match(skill,/Do not create ten cosmetic variants/i);
assert.match(skill,/A lesson below 8 role-addressed approved visuals remains visually incomplete/i);
console.log('THC encyclopedia production skill contract passed.');
