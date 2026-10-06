import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COHORT_SIZE,
  OBSERVATION_BUDGET,
  SHORTLIST_LIMIT,
  createHunt,
  observe,
  toggleShortlist,
  finalizeKeeper,
  normalizeHunterCode,
  isValidHunterCode,
  topCandidates,
  hunterRank
} from '../src/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.resolve(here, '../data/phenos.json'), 'utf8'));

assert.equal(normalizeHunterCode(' phio01-4242 '), 'PH4242');
assert.equal(isValidHunterCode('PH4242'), true);
assert.equal(isValidHunterCode('PH424'), false);

const first = createHunt({ code: 'HUNT42' }, data);
const second = createHunt({ code: 'HUNT42' }, data);
assert.deepEqual(first, second);
assert.equal(first.cohortIds.length, COHORT_SIZE);
assert.equal(new Set(first.cohortIds).size, COHORT_SIZE);
assert.equal(first.observationBudget, OBSERVATION_BUDGET);

const different = createHunt({ code: 'SC8UT8' }, data);
assert.ok(first.briefId !== different.briefId || JSON.stringify(first.cohortIds) !== JSON.stringify(different.cohortIds));

const candidateId = first.cohortIds[0];
const original = structuredClone(first);
const observed = observe(first, { candidateId, traitId: data.hiddenTraits[0] }, data);
assert.deepEqual(first, original, 'observe must not mutate input state');
assert.equal(observed.observationBudget, OBSERVATION_BUDGET - 1);
assert.equal(observed.observations.length, 1);
const duplicate = observe(observed, { candidateId, traitId: data.hiddenTraits[0] }, data);
assert.equal(duplicate.observationBudget, observed.observationBudget);
assert.throws(() => observe(first, { candidateId, traitId: data.visibleTraits[0] }, data), /not a scoutable hidden trait/);

let exhausted = first;
for (let index = 0; index < OBSERVATION_BUDGET; index += 1) {
  const candidate = first.cohortIds[Math.floor(index / data.hiddenTraits.length)];
  const trait = data.hiddenTraits[index % data.hiddenTraits.length];
  exhausted = observe(exhausted, { candidateId: candidate, traitId: trait }, data);
}
assert.equal(exhausted.observationBudget, 0);
assert.throws(() => observe(exhausted, { candidateId: first.cohortIds[3], traitId: data.hiddenTraits[0] }, data), /No scouting tokens remain/);

let shortlist = first;
for (const id of first.cohortIds.slice(0, SHORTLIST_LIMIT)) shortlist = toggleShortlist(shortlist, id, data);
assert.equal(shortlist.shortlisted.length, SHORTLIST_LIMIT);
assert.throws(() => toggleShortlist(shortlist, first.cohortIds[SHORTLIST_LIMIT], data), /Shortlist limit/);
shortlist = toggleShortlist(shortlist, first.cohortIds[0], data);
assert.equal(shortlist.shortlisted.length, SHORTLIST_LIMIT - 1);
assert.throws(() => finalizeKeeper(first, candidateId, data), /must be on the shortlist/);

const ranking = topCandidates(first, data);
assert.equal(ranking.length, COHORT_SIZE);
assert.ok(ranking[0].fit >= ranking.at(-1).fit);

const bestId = ranking[0].candidateId;
let perfect = first;
for (const traitId of data.hiddenTraits) perfect = observe(perfect, { candidateId: bestId, traitId }, data);
const comparisonIds = first.cohortIds.filter((id) => id !== bestId).slice(0, 2);
for (const id of comparisonIds) perfect = observe(perfect, { candidateId: id, traitId: data.hiddenTraits[0] }, data);
perfect = toggleShortlist(perfect, bestId, data);
perfect = finalizeKeeper(perfect, bestId, data);
assert.equal(perfect.status, 'complete');
assert.equal(perfect.result.selectedCandidateId, bestId);
assert.equal(perfect.result.bestCandidateId, bestId);
assert.equal(perfect.result.qualityScore, 70);
assert.equal(perfect.result.evidenceScore, 20);
assert.equal(perfect.result.comparisonScore, 10);
assert.equal(perfect.result.score, 100);
assert.equal(perfect.result.rank, 'Elite Scout');
assert.equal(hunterRank(87), 'Sharp Eye');

console.log('Pheno Hunter deterministic engine tests passed.');
