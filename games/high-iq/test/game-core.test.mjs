import assert from 'node:assert/strict';
import { balancedSample, createRng, hashString, rankForPercent, seededShuffle, shouldIgnoreQuizShortcutTarget } from '../../../site/public-route-patch/games/high-iq/game-core.mjs';

assert.equal(hashString('High IQ'), hashString('High IQ'));
assert.notEqual(hashString('High IQ'), hashString('High IQ!'));

const rngA = createRng('daily-2026-08-27');
const rngB = createRng('daily-2026-08-27');
assert.deepEqual([rngA(), rngA(), rngA()], [rngB(), rngB(), rngB()]);

const items = Array.from({ length: 20 }, (_, index) => ({
  id: `Q${index + 1}`,
  category: `C${index % 4}`,
  difficulty: ['Easy', 'Medium', 'Hard', 'Expert'][index % 4]
}));
const shuffleA = seededShuffle(items, 'same-seed').map((item) => item.id);
const shuffleB = seededShuffle(items, 'same-seed').map((item) => item.id);
assert.deepEqual(shuffleA, shuffleB);
assert.equal(new Set(shuffleA).size, items.length);

const sampleA = balancedSample(items, 10, 'daily-key').map((item) => item.id);
const sampleB = balancedSample(items, 10, 'daily-key').map((item) => item.id);
assert.deepEqual(sampleA, sampleB);
assert.equal(sampleA.length, 10);
assert.equal(new Set(sampleA).size, 10);

const sampleAll = balancedSample(items, 99, 'all');
assert.equal(sampleAll.length, items.length);
assert.equal(new Set(sampleAll.map((item) => item.id)).size, items.length);

assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'A' }), true);
assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'SUMMARY' }), true);
assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'SELECT' }), true);
assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'BUTTON' }), false);
assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'H2' }), false);
assert.equal(shouldIgnoreQuizShortcutTarget({ tagName: 'DIV', isContentEditable: true }), true);

assert.equal(rankForPercent(100), 'High IQ Master');
assert.equal(rankForPercent(92), 'High IQ Master');
assert.equal(rankForPercent(82), 'Advanced');
assert.equal(rankForPercent(70), 'Proficient');
assert.equal(rankForPercent(58), 'Developing');
assert.equal(rankForPercent(57), 'Study Run');

console.log('High IQ game-core tests passed.');
