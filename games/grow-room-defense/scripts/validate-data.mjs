import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync(new URL('../data/ipm.json', import.meta.url), 'utf8'));
const publicData = JSON.parse(fs.readFileSync(new URL('../../../site/public-route-patch/games/grow-room-defense/data/ipm.json', import.meta.url), 'utf8'));

assert.deepEqual(publicData, canonical, 'Public Grow Room Defense data drifted from canonical source.');
assert.equal(canonical.schemaVersion, 1);
assert.equal(canonical.lanes.length, 3);
assert.equal(canonical.threats.length, 8);
assert.equal(canonical.tools.length, 7);
assert.match(canonical.disclaimer, /does not provide pesticide mixing/i);

const laneIds = new Set();
for (const lane of canonical.lanes) {
  assert.match(lane.id, /^[a-z0-9-]+$/);
  assert.ok(lane.label?.trim());
  assert.ok(lane.plant?.trim());
  assert.ok(!laneIds.has(lane.id), `Duplicate lane id: ${lane.id}`);
  laneIds.add(lane.id);
}

const toolIds = new Set();
const availableStrengths = new Set();
for (const tool of canonical.tools) {
  assert.match(tool.id, /^[a-z0-9-]+$/);
  assert.ok(tool.label?.trim());
  assert.ok(tool.mark?.trim());
  assert.ok(Number.isInteger(tool.power) && tool.power > 0);
  assert.ok(Array.isArray(tool.strengths) && tool.strengths.length > 0);
  assert.ok(tool.description?.trim());
  assert.ok(!toolIds.has(tool.id), `Duplicate tool id: ${tool.id}`);
  toolIds.add(tool.id);
  for (const strength of tool.strengths) availableStrengths.add(strength);
}

const threatIds = new Set();
for (const threat of canonical.threats) {
  assert.match(threat.id, /^[a-z0-9-?]+$/);
  assert.ok(threat.label?.trim());
  assert.ok(threat.mark?.trim());
  assert.ok(threat.category?.trim());
  assert.ok(Number.isInteger(threat.pressure) && threat.pressure > 0);
  assert.ok(Number.isInteger(threat.damage) && threat.damage > 0);
  assert.ok(Array.isArray(threat.weaknesses) && threat.weaknesses.length >= 2);
  assert.ok(threat.lesson?.trim());
  assert.ok(!threatIds.has(threat.id), `Duplicate threat id: ${threat.id}`);
  threatIds.add(threat.id);
  for (const weakness of threat.weaknesses) {
    assert.ok(availableStrengths.has(weakness), `${threat.id} weakness ${weakness} has no matching tool.`);
  }
}

const prose = JSON.stringify(canonical.tools) + JSON.stringify(canonical.threats);
assert.doesNotMatch(prose, /\b(?:ml|milliliters?|teaspoons?|tablespoons?|ounces?|gallons?)\b/i, 'Game content must not drift into pesticide mixing/application-rate instructions.');

console.log('Grow Room Defense data valid: 3 lanes, 8 threats, 7 tools.');
