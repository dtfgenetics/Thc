import assert from 'node:assert/strict';
import fs from 'node:fs';
import { askQuestion, createGame, questionOptions } from '../src/engine.mjs';
import { informationScore, rankedQuestionOptions } from '../src/analysis.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/strains.json', import.meta.url), 'utf8'));

assert.equal(informationScore({ yesCount: 10, noCount: 10 }), 100);
assert.equal(informationScore({ yesCount: 15, noCount: 5 }), 50);
assert.equal(informationScore({ yesCount: 20, noCount: 0 }), 0);
assert.equal(informationScore({ yesCount: 0, noCount: 0 }), 0);
assert.equal(informationScore({ yesCount: -1, noCount: 5 }), 0);

const game = createGame({ code: 'GR8W42' }, data);
const beforeGame = structuredClone(game);
const beforeData = structuredClone(data);
const plain = questionOptions(game, data);
const ranked = rankedQuestionOptions(game, data);
assert.deepEqual(game, beforeGame, 'ranking questions must not mutate game state');
assert.deepEqual(data, beforeData, 'ranking questions must not mutate game data');
assert.equal(ranked.length, plain.length);
assert.deepEqual(new Set(ranked.map((option) => option.id)), new Set(plain.map((option) => option.id)));
assert.ok(ranked.every((option) => option.informative));
for (let index = 1; index < ranked.length; index += 1) {
  assert.ok(ranked[index - 1].informationScore >= ranked[index].informationScore, 'questions should be ordered by information score');
}
if (ranked.length) {
  assert.equal(ranked.filter((option) => option.bestSplit).length, 1, 'exactly one current question should be labelled best split');
  assert.equal(ranked[0].bestSplit, true);
}

const chosen = ranked[0];
const afterQuestion = askQuestion(game, chosen.id, data);
const reranked = rankedQuestionOptions(afterQuestion, data);
assert.ok(!reranked.some((option) => option.id === chosen.id), 'asked question must stay removed from the ranking');
for (const option of reranked) {
  assert.equal(option.informationScore, informationScore(option));
}

const tieState = {
  ...game,
  candidates: data.strains.slice(0, 4).map((strain) => strain.id)
};
const tiedA = rankedQuestionOptions(tieState, data);
const tiedB = rankedQuestionOptions(tieState, data);
assert.deepEqual(tiedA, tiedB, 'question ranking must be stable for identical state');

console.log('Mystery Strain information-ranking tests passed.');
