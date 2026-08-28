import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CASE_ALPHABET,
  askQuestion,
  createGame,
  gameScore,
  guessStrain,
  isValidCaseCode,
  normalizeCaseCode,
  questionOptions,
  questionsLeft
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/strains.json', import.meta.url), 'utf8'));

assert.equal(normalizeCaseCode('ab-cd ef'), 'ABCDEF');
assert.equal(isValidCaseCode('ABCDE'), false);
assert.equal(isValidCaseCode('ABCDEF'), true);

const a = createGame({ code: 'GROW42', wild: false }, data);
const b = createGame({ code: 'grow42', wild: false }, data);
assert.equal(a.secretId, b.secretId, 'Same case code should select the same secret.');
assert.equal(a.modifier, null);
assert.equal(a.maxQuestions, 8);
assert.equal(a.guessesLeft, 3);
assert.equal(a.candidates.length, 20);

const firstQuestion = questionOptions(a, data)[0];
assert.ok(firstQuestion?.informative);
const afterQuestion = askQuestion(a, firstQuestion.id, data);
assert.ok(afterQuestion.candidates.includes(afterQuestion.secretId));
assert.ok(afterQuestion.candidates.length < a.candidates.length, 'Useful answer should narrow candidates.');
assert.equal(afterQuestion.clues.at(-1).answer === 'yes' || afterQuestion.clues.at(-1).answer === 'no', true);
assert.equal(questionsLeft(afterQuestion), 7);
assert.throws(() => askQuestion(afterQuestion, firstQuestion.id, data), /already used/);

const wrongId = afterQuestion.candidates.find((id) => id !== afterQuestion.secretId);
assert.ok(wrongId);
const afterWrongGuess = guessStrain(afterQuestion, wrongId, data);
assert.equal(afterWrongGuess.guessesLeft, 2);
assert.ok(!afterWrongGuess.candidates.includes(wrongId));
assert.equal(afterWrongGuess.status, 'playing');

const won = guessStrain(afterWrongGuess, afterWrongGuess.secretId, data);
assert.equal(won.status, 'won');
assert.ok(Number.isInteger(gameScore(won)) && gameScore(won) >= 0);

let losing = createGame({ code: 'LOSS42', wild: false }, data);
while (losing.status === 'playing') {
  const wrong = losing.candidates.find((id) => id !== losing.secretId);
  losing = guessStrain(losing, wrong, data);
}
assert.equal(losing.status, 'lost');
assert.equal(losing.guessesLeft, 0);
assert.ok(losing.candidates.includes(losing.secretId));

function codeFor(index) {
  let value = index;
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code = CASE_ALPHABET[value % CASE_ALPHABET.length] + code;
    value = Math.floor(value / CASE_ALPHABET.length);
  }
  return code;
}

let foggy = null;
for (let index = 0; index < 300 && !foggy; index += 1) {
  const candidate = createGame({ code: codeFor(index), wild: true }, data);
  if (candidate.modifier?.id === 'foggy-jar') foggy = candidate;
}
assert.ok(foggy, 'Expected to find a deterministic Foggy Jar case.');

while (foggy.questionsAsked.length < foggy.fogQuestionIndex) {
  const option = questionOptions(foggy, data)[0];
  assert.ok(option, 'Expected an informative question before the fog clue.');
  foggy = askQuestion(foggy, option.id, data);
}
const fogOption = questionOptions(foggy, data)[0];
assert.ok(fogOption);
const beforeFog = foggy.candidates.length;
foggy = askQuestion(foggy, fogOption.id, data);
assert.equal(foggy.clues.at(-1).answer, 'unknown');
assert.equal(foggy.candidates.length, beforeFog, 'Foggy Jar must not eliminate candidates.');

const wildA = createGame({ code: 'WILD42', wild: true }, data);
const wildB = createGame({ code: 'WILD42', wild: true }, data);
assert.equal(wildA.modifier?.id, wildB.modifier?.id, 'Wild modifier must be deterministic for a case code.');

console.log('Mystery Strain deterministic engine tests passed.');
