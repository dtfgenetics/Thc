import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createRun,
  generatePhenotypes,
  goalFit,
  isValidRunCode,
  normalizeRunCode,
  refreshDraft,
  runRank,
  selectParent,
  selectPhenotype
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const cardById = new Map(data.cards.map((card) => [card.id, card]));
const goalById = new Map(data.goals.map((goal) => [goal.id, goal]));

assert.equal(normalizeRunCode('ph-d8 42'), 'PHD842');
assert.equal(isValidRunCode('PHD84'), false);
assert.equal(isValidRunCode('PHD842'), true);

const first = createRun({ code: 'PHD842' }, data);
const repeated = createRun({ code: 'phd842' }, data);
assert.equal(first.founderCardId, repeated.founderCardId);
assert.equal(first.goalId, repeated.goalId);
assert.deepEqual(first.offers, repeated.offers);
assert.equal(first.offers.length, 3);
assert.equal(new Set(first.offers).size, 3);
assert.ok(!first.offers.includes(first.founderCardId));
assert.ok(first.currentFit >= 0 && first.currentFit <= 100);

const beforeRefresh = structuredClone(first);
const refreshed = refreshDraft(first, data);
assert.deepEqual(first, beforeRefresh, 'refreshDraft must not mutate its input state.');
assert.equal(refreshed.round, 1);
assert.equal(refreshed.phase, 'draft');
assert.equal(refreshed.refreshesRemaining, 1);
assert.equal(refreshed.refreshesUsed, 1);
assert.equal(refreshed.offers.length, 3);
assert.equal(new Set(refreshed.offers).size, 3);
assert.equal(refreshed.offers.filter((id) => first.offers.includes(id)).length, 0, 'A refresh should replace the active offer when enough cards remain.');
const refreshedTwice = refreshDraft(refreshed, data);
assert.equal(refreshedTwice.refreshesRemaining, 0);
assert.throws(() => refreshDraft(refreshedTwice, data), /No draft refresh tokens remain/);

assert.throws(() => selectParent(first, 'not-a-card', data), /not in the current draft offer/);
const parentId = first.offers[0];
const beforeParent = structuredClone(first);
const crossed = selectParent(first, parentId, data);
assert.deepEqual(first, beforeParent, 'selectParent must not mutate its input state.');
assert.equal(crossed.phase, 'phenotype');
assert.equal(crossed.selectedParentId, parentId);
assert.equal(crossed.phenotypes.length, 3);
assert.equal(new Set(crossed.phenotypes.map((line) => line.lineId)).size, 3);
for (const line of crossed.phenotypes) {
  for (const value of Object.values(line.traits)) {
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 10);
  }
  assert.ok(line.sourceCardIds.includes(first.founderCardId));
  assert.ok(line.sourceCardIds.includes(parentId));
}

const directPhenotypes = generatePhenotypes(first.currentLine, cardById.get(parentId), { code: first.code, round: first.round }, data);
assert.deepEqual(directPhenotypes, crossed.phenotypes, 'The same cross must reproduce the same three phenotype cards.');

const goal = goalById.get(first.goalId);
const bestFirst = [...crossed.phenotypes].sort((a, b) => goalFit(b, goal, data) - goalFit(a, goal, data))[0];
const beforeKeep = structuredClone(crossed);
const kept = selectPhenotype(crossed, bestFirst.lineId, data);
assert.deepEqual(crossed, beforeKeep, 'selectPhenotype must not mutate its input state.');
assert.equal(kept.round, 2);
assert.equal(kept.phase, 'draft');
assert.equal(kept.archive.length, 1);
assert.equal(kept.usedParentIds.length, 1);
assert.equal(kept.usedParentIds[0], parentId);
assert.ok(kept.score >= 0);
assert.ok(!kept.offers.includes(parentId), 'A selected parent must not be offered again later in the run.');

let run = createRun({ code: 'DRAFT7' }, data);
while (run.status === 'playing') {
  const runGoal = goalById.get(run.goalId);
  let best = null;
  for (const offeredParentId of run.offers) {
    const candidateCross = selectParent(run, offeredParentId, data);
    for (const phenotype of candidateCross.phenotypes) {
      const fit = goalFit(phenotype, runGoal, data);
      if (!best || fit > best.fit) best = { parentId: offeredParentId, lineId: phenotype.lineId, fit };
    }
  }
  const selectedCross = selectParent(run, best.parentId, data);
  run = selectPhenotype(selectedCross, best.lineId, data);
}

assert.equal(run.status, 'complete');
assert.equal(run.phase, 'complete');
assert.equal(run.round, data.rounds);
assert.equal(run.archive.length, data.rounds);
assert.equal(run.usedParentIds.length, data.rounds);
assert.equal(new Set(run.usedParentIds).size, data.rounds, 'Selected parents must be unique across the full run.');
assert.equal(run.offers.length, 0);
assert.equal(run.phenotypes.length, 0);
assert.ok(run.score > 0);
assert.ok(run.currentFit >= 0 && run.currentFit <= 100);
assert.ok(run.finalRank);
assert.equal(runRank(run, data), run.finalRank);

console.log('Pheno Draft deterministic engine tests passed.');
