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
  'Expansion gate'
]){
  assert.ok(skill.includes(marker),`skill missing required contract marker: ${marker}`);
}
assert.match(skill,/repeatable production system/i);
assert.match(skill,/Never recycle or renumber/i);
assert.match(skill,/provider-independent/i);
console.log('THC encyclopedia production skill contract passed.');
