import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const publicCopy = JSON.parse(fs.readFileSync(new URL('../../../site/public-route-patch/games/pheno-draft/data/cards.json', import.meta.url), 'utf8'));

assert.deepEqual(publicCopy, canonical, 'Public Pheno Draft data must exactly match canonical data.');
assert.equal(canonical.schemaVersion, 1);
assert.equal(canonical.rounds, 6);
assert.equal(canonical.refreshTokens, 2);
assert.equal(canonical.traits.length, 7);
assert.equal(canonical.goals.length, 6);
assert.equal(canonical.cards.length, 20);

const traitIds = canonical.traits.map((trait) => trait.id);
assert.equal(new Set(traitIds).size, traitIds.length, 'Trait ids must be unique.');
for (const trait of canonical.traits) {
  assert.match(trait.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(trait.label?.trim());
}

const goalIds = canonical.goals.map((goal) => goal.id);
assert.equal(new Set(goalIds).size, goalIds.length, 'Goal ids must be unique.');
for (const goal of canonical.goals) {
  assert.ok(goal.label?.trim());
  assert.ok(goal.description?.trim());
  let positiveWeights = 0;
  for (const traitId of traitIds) {
    const weight = goal.weights?.[traitId];
    assert.ok(Number.isInteger(weight) && weight >= 0 && weight <= 3, `${goal.id}.${traitId} weight must be 0..3`);
    if (weight > 0) positiveWeights += 1;
  }
  assert.ok(positiveWeights >= 3, `${goal.id} should care about at least three traits.`);
}

const cardIds = canonical.cards.map((card) => card.id);
assert.equal(new Set(cardIds).size, cardIds.length, 'Card ids must be unique.');
const labels = canonical.cards.map((card) => card.label.toLowerCase());
assert.equal(new Set(labels).size, labels.length, 'Card labels must be unique.');
for (const card of canonical.cards) {
  assert.match(card.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(card.label?.trim());
  assert.ok(card.family?.trim());
  assert.ok(Number.isInteger(card.hue) && card.hue >= 0 && card.hue < 360, `${card.id} hue must be 0..359`);
  assert.deepEqual(Object.keys(card.traits).sort(), [...traitIds].sort(), `${card.id} must define every locked trait.`);
  for (const traitId of traitIds) {
    const value = card.traits[traitId];
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 10, `${card.id}.${traitId} must be 1..10`);
  }
}

console.log('Pheno Draft card data validation passed.');
