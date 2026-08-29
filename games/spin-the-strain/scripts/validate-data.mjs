import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonicalText = fs.readFileSync(new URL('../data/wheels.json', import.meta.url), 'utf8');
const publicText = fs.readFileSync(new URL('../../../site/public-route-patch/games/spin-the-strain/data/wheels.json', import.meta.url), 'utf8');
const data = JSON.parse(canonicalText);
const publicData = JSON.parse(publicText);

assert.deepEqual(publicData, data, 'Public Spin the Strain data drifted from canonical source.');
assert.equal(data.schemaVersion, 1);
assert.deepEqual(data.modes.map((mode) => mode.id), ['strain-picker', 'grow-challenge', 'community-wildcard']);

const modeIds = new Set(data.modes.map((mode) => mode.id));
const ids = new Set();
for (const entry of data.entries) {
  assert.match(entry.id, /^[a-z0-9-]+$/);
  assert.ok(modeIds.has(entry.mode), `${entry.id} references unknown mode ${entry.mode}`);
  assert.ok(entry.label?.trim());
  assert.ok(entry.detail?.trim());
  assert.ok(entry.category?.trim());
  assert.ok(!ids.has(entry.id), `Duplicate entry id: ${entry.id}`);
  ids.add(entry.id);
}

for (const mode of data.modes) {
  const entries = data.entries.filter((entry) => entry.mode === mode.id);
  assert.equal(entries.length, 18, `${mode.id} should contain exactly 18 equal-weight entries.`);
  assert.equal(new Set(entries.map((entry) => entry.label)).size, entries.length, `${mode.id} contains duplicate labels.`);
}

assert.equal(data.entries.length, 54);
console.log('Spin the Strain data valid: 3 modes, 54 equal-weight entries.');
