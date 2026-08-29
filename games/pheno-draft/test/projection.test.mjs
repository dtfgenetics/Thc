import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRun, generatePhenotypes, goalFit } from '../src/engine.mjs';
import { projectedCrossFit, projectedCrossLine, projectionSummary } from '../src/projection.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const cardById = new Map(data.cards.map((card) => [card.id, card]));
const goalById = new Map(data.goals.map((goal) => [goal.id, goal]));

const run = createRun({ code: 'PHD842' }, data);
const parent = cardById.get(run.offers[0]);
const goal = goalById.get(run.goalId);
const currentBefore = structuredClone(run.currentLine);
const parentBefore = structuredClone(parent);

const line = projectedCrossLine(run.currentLine, parent, data);
assert.deepEqual(run.currentLine, currentBefore, 'projection must not mutate the current line');
assert.deepEqual(parent, parentBefore, 'projection must not mutate the parent card');
assert.equal(line.generation, run.currentLine.generation + 1);
assert.ok(line.sourceCardIds.includes(parent.id));

for (const trait of data.traits) {
  const expected = Math.round((run.currentLine.traits[trait.id] + parent.traits[trait.id]) / 2);
  assert.equal(line.traits[trait.id], expected, `projection should use midpoint for ${trait.id}`);
}

const fit = projectedCrossFit(run.currentLine, parent, goal, data);
assert.equal(fit, goalFit(line, goal, data));
assert.ok(fit >= 0 && fit <= 100);

const summary = projectionSummary(run.currentLine, parent, goal, data);
assert.equal(summary.fit, fit);
assert.equal(summary.delta, fit - run.currentFit);
assert.deepEqual(summary.line, line);

const actualA = generatePhenotypes(run.currentLine, parent, { code: 'PHD842', round: run.round }, data);
const actualB = generatePhenotypes(run.currentLine, parent, { code: 'DRAFT7', round: run.round }, data);
assert.notDeepEqual(actualA, actualB, 'hidden phenotype outcomes should still depend on run code');
assert.equal(
  projectedCrossFit(run.currentLine, parent, goal, data),
  fit,
  'projection must remain independent of hidden run-code variance'
);

const actualTraitSignatures = actualA.map((candidate) => JSON.stringify(candidate.traits));
assert.ok(
  actualTraitSignatures.some((signature) => signature !== JSON.stringify(line.traits)),
  'projection should not reveal the exact hidden phenotype cards'
);

assert.throws(
  () => projectedCrossLine({ traits: {} }, parent, data),
  /Missing numeric trait values/,
  'invalid trait profiles should fail closed'
);

console.log('Pheno Draft parent projection tests passed.');
