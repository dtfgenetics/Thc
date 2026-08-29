import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonicalPath = new URL('../data/shift.json', import.meta.url);
const publicPath = new URL('../../../site/public-route-patch/games/harvest-hustle/data/shift.json', import.meta.url);
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

assert.deepEqual(publicCopy, canonical, 'Public Harvest Hustle data must exactly match canonical data.');
assert.equal(canonical.schemaVersion, 1);
assert.ok(Number.isInteger(canonical.shiftSeconds) && canonical.shiftSeconds >= 30 && canonical.shiftSeconds <= 180);
assert.ok(Number.isInteger(canonical.queueSize) && canonical.queueSize >= 2 && canonical.queueSize <= 6);
assert.equal(canonical.stations.length, 4);

const stationIds = canonical.stations.map((station) => station.id);
assert.equal(new Set(stationIds).size, stationIds.length, 'Station IDs must be unique.');
assert.deepEqual(new Set(stationIds), new Set(['tag', 'trim', 'rack', 'pack']));
for (const station of canonical.stations) {
  assert.ok(station.label?.trim());
  assert.ok(station.short?.trim());
  assert.ok(station.mark?.trim());
  assert.ok(station.description?.trim());
}

assert.ok(canonical.batches.length >= 10, 'Harvest Hustle needs enough batch variety for repeatable arcade play.');
const batchIds = canonical.batches.map((batch) => batch.id);
assert.equal(new Set(batchIds).size, batchIds.length, 'Batch IDs must be unique.');

for (const batch of canonical.batches) {
  assert.ok(batch.label?.trim());
  assert.ok(batch.theme?.trim());
  assert.ok(Number.isInteger(batch.value) && batch.value >= 50 && batch.value <= 300);
  assert.ok(Number.isInteger(batch.patience) && batch.patience >= 10 && batch.patience <= 30);
  assert.ok(Array.isArray(batch.steps) && batch.steps.length >= 3 && batch.steps.length <= 4);
  assert.equal(batch.steps[0], 'tag', `${batch.id} must begin with the game ticket step.`);
  assert.equal(batch.steps.at(-1), 'pack', `${batch.id} must end at the game finish station.`);
  for (const step of batch.steps) assert.ok(stationIds.includes(step), `${batch.id} uses unknown station ${step}.`);
  for (let index = 1; index < batch.steps.length; index += 1) {
    assert.notEqual(batch.steps[index], batch.steps[index - 1], `${batch.id} repeats the same station consecutively.`);
  }
}

const text = JSON.stringify(canonical);
for (const forbidden of ['ppm', '°F', '°C', 'grams', 'ounces', 'milliliters', 'humidity target', 'drying target']) {
  assert.equal(text.toLowerCase().includes(forbidden.toLowerCase()), false, `Game data must not contain real-world processing parameter: ${forbidden}`);
}

console.log(`Harvest Hustle data valid: ${canonical.stations.length} stations, ${canonical.batches.length} fictional batches.`);
