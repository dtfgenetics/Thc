import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAX_PLAYERS, DEFAULT_ROUNDS, scoreVote, applyVoteResult, rankPlayers } from '../src/rules.mjs';

const deck = JSON.parse(fs.readFileSync(new URL('../data/playtest-v1.json', import.meta.url), 'utf8'));
assert.equal(MAX_PLAYERS, 10);
assert.equal(DEFAULT_ROUNDS, 12);
assert.ok(deck.cards.length >= 40, 'playtest deck should contain at least 40 cards');
assert.equal(new Set(deck.cards.map(card => card.id)).size, deck.cards.length, 'card IDs must be unique');
assert.equal(deck.cards.filter(card => card.answer === 'BUD').length, deck.cards.filter(card => card.answer === 'BLUFF').length, 'deck should be balanced');
assert.deepEqual(scoreVote('BUD', 'BUD', false), { correct: true, delta: 1 });
assert.deepEqual(scoreVote('BLUFF', 'BUD', true), { correct: false, delta: -1 });
const advanced = applyVoteResult({ name: 'A', score: 2, streak: 2, bestStreak: 2, doubleUsed: false }, 'BUD', 'BUD', true);
assert.equal(advanced.score, 4);
assert.equal(advanced.streak, 3);
assert.equal(advanced.bestStreak, 3);
assert.equal(advanced.doubleUsed, true);
assert.deepEqual(rankPlayers([{name:'B',score:2,bestStreak:1},{name:'A',score:2,bestStreak:3}]).map(p=>p.name), ['A','B']);
console.log(`Bud or Bluff rules OK: ${deck.cards.length} cards, 10-player cap, balanced deck.`);
