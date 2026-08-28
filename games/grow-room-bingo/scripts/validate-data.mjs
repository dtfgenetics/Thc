import fs from 'node:fs';
import assert from 'node:assert/strict';

const canonical = fs.readFileSync(new URL('../data/prompts.json', import.meta.url), 'utf8');
const publicCopy = fs.readFileSync(new URL('../../../site/public-route-patch/games/grow-room-bingo/data/prompts.json', import.meta.url), 'utf8');
const data = JSON.parse(canonical);
const publicData = JSON.parse(publicCopy);
assert.deepEqual(publicData, data, 'Public bingo prompt data drifted from canonical source');
assert.equal(data.schemaVersion, 1);
assert.deepEqual(data.modes.map((mode) => mode.id), ['grow-room','bongwater','mixed']);
const ids = new Set();
for (const prompt of data.prompts) {
  assert.match(prompt.id, /^[a-z0-9-]+$/);
  assert.ok(prompt.text?.trim());
  assert.ok(['grow-room','bongwater'].includes(prompt.mode));
  assert.ok(!ids.has(prompt.id), `Duplicate prompt id: ${prompt.id}`);
  ids.add(prompt.id);
}
for (const mode of ['grow-room','bongwater']) {
  assert.ok(data.prompts.filter((prompt) => prompt.mode === mode).length >= 24, `${mode} needs at least 24 prompts`);
}
console.log(`Grow Room Bingo data valid: ${data.prompts.length} prompts across two source pools.`);
