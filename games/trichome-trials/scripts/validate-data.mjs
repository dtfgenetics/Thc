import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonicalPath = new URL('../data/trials.json', import.meta.url);
const publicPath = new URL('../../../site/public-route-patch/games/trichome-trials/data/trials.json', import.meta.url);
const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

assert.deepEqual(publicCopy, canonical, 'Public Trichome Trials data must exactly match canonical data.');
assert.equal(canonical.schemaVersion, 1);
assert.equal(canonical.roundsPerRun, 5);

const expectedCategories = ['structure','resin','terps','yield','color','documentation','problem-solving'];
assert.equal(canonical.categories.length, expectedCategories.length);
assert.deepEqual(canonical.categories.map((category) => category.id), expectedCategories);
for (const category of canonical.categories) {
  assert.ok(category.label?.trim());
  assert.ok(category.short?.trim());
  assert.ok(category.rubric?.trim());
}

assert.ok(canonical.entries.length >= 10, 'Trichome Trials needs at least 10 fictional judging entries.');
const ids = canonical.entries.map((entry) => entry.id);
assert.equal(new Set(ids).size, ids.length, 'Entry IDs must be unique.');
const codeNames = canonical.entries.map((entry) => entry.codeName);
assert.equal(new Set(codeNames).size, codeNames.length, 'Entry code names must be unique.');

const validHues = new Set(['violet','lime','purple','gold','silver','ruby','cream']);
const validSpreads = new Set(['wide','upright','compact']);
for (const entry of canonical.entries) {
  assert.ok(entry.label?.trim());
  assert.ok(entry.codeName?.trim());
  assert.equal(entry.evidence?.length, expectedCategories.length, `${entry.id} must provide one evidence line per category.`);
  entry.evidence.forEach((line) => assert.ok(line?.trim()));
  assert.ok(validHues.has(entry.visual?.hue), `${entry.id} has unsupported visual hue.`);
  assert.ok(Number.isInteger(entry.visual?.frost) && entry.visual.frost >= 1 && entry.visual.frost <= 5);
  assert.ok(Number.isInteger(entry.visual?.mass) && entry.visual.mass >= 1 && entry.visual.mass <= 5);
  assert.ok(validSpreads.has(entry.visual?.spread), `${entry.id} has unsupported visual spread.`);

  assert.deepEqual(Object.keys(entry.scores), expectedCategories, `${entry.id} score categories must stay ordered and complete.`);
  assert.deepEqual(Object.keys(entry.notes), expectedCategories, `${entry.id} benchmark notes must stay ordered and complete.`);
  for (const categoryId of expectedCategories) {
    const score = entry.scores[categoryId];
    assert.ok(Number.isInteger(score) && score >= 1 && score <= 10, `${entry.id}/${categoryId} score must be 1–10.`);
    assert.ok(entry.notes[categoryId]?.trim(), `${entry.id}/${categoryId} needs a benchmark explanation.`);
  }
}

const text = JSON.stringify(canonical).toLowerCase();
for (const forbidden of ['thc %','cbd %','milligrams','dosage','consume','smoke this','pesticide rate','mixing rate']) {
  assert.equal(text.includes(forbidden), false, `Judging data must not contain prohibited real-world claim/instruction text: ${forbidden}`);
}

console.log(`Trichome Trials data valid: ${canonical.entries.length} fictional entries, ${canonical.categories.length} judging categories.`);
