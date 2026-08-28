import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonicalText = fs.readFileSync(new URL('../data/strains.json', import.meta.url), 'utf8');
const publicText = fs.readFileSync(new URL('../../../site/public-route-patch/games/mystery-strain/data/strains.json', import.meta.url), 'utf8');
const data = JSON.parse(canonicalText);
const publicData = JSON.parse(publicText);

assert.deepEqual(publicData, data, 'Public Mystery Strain data drifted from canonical source.');
assert.equal(data.schemaVersion, 1);
assert.equal(data.questions.length, 12, 'Mystery Strain should expose 12 deduction questions.');
assert.equal(data.strains.length, 20, 'Mystery Strain should expose 20 fictional profiles.');
assert.match(data.disclaimer, /fictional/i);

const questionIds = new Set();
for (const question of data.questions) {
  assert.match(question.id, /^[a-z0-9-]+$/);
  assert.ok(question.group?.trim());
  assert.ok(question.prompt?.trim());
  assert.ok(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
  questionIds.add(question.id);
}

const strainIds = new Set();
const names = new Set();
const signatures = new Set();
for (const strain of data.strains) {
  assert.match(strain.id, /^[a-z0-9-]+$/);
  assert.ok(strain.name?.trim());
  assert.ok(!strainIds.has(strain.id), `Duplicate strain id: ${strain.id}`);
  assert.ok(!names.has(strain.name), `Duplicate strain name: ${strain.name}`);
  strainIds.add(strain.id);
  names.add(strain.name);
  assert.ok(Array.isArray(strain.traits));
  assert.ok(strain.traits.length >= 4 && strain.traits.length <= 6, `${strain.id} should have 4-6 traits`);
  assert.equal(new Set(strain.traits).size, strain.traits.length, `${strain.id} contains duplicate traits`);
  for (const trait of strain.traits) assert.ok(questionIds.has(trait), `${strain.id} uses unknown trait ${trait}`);
  const signature = [...strain.traits].sort().join('|');
  assert.ok(!signatures.has(signature), `Duplicate trait signature: ${signature}`);
  signatures.add(signature);
}

for (const question of data.questions) {
  const yes = data.strains.filter((strain) => strain.traits.includes(question.id)).length;
  assert.ok(yes >= 4, `${question.id} appears on too few profiles (${yes})`);
  assert.ok(yes <= data.strains.length - 4, `${question.id} appears on too many profiles (${yes})`);
}

console.log(`Mystery Strain data valid: ${data.strains.length} fictional profiles, ${data.questions.length} questions.`);
