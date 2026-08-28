import assert from 'node:assert/strict';
import { CARD_CODE_ALPHABET, CARD_CODE_LENGTH, isValidCardCode, normalizeCardCode } from '../code-utils.mjs';

assert.equal(CARD_CODE_LENGTH, 6);
assert.equal(CARD_CODE_ALPHABET.includes('I'), false);
assert.equal(CARD_CODE_ALPHABET.includes('O'), false);
assert.equal(CARD_CODE_ALPHABET.includes('0'), false);
assert.equal(CARD_CODE_ALPHABET.includes('1'), false);

assert.equal(normalizeCardCode('abcdef'), 'ABCDEF');
assert.equal(normalizeCardCode('ab-cd ef'), 'ABCDEF');
assert.equal(normalizeCardCode('ABOI01'), 'AB');
assert.equal(isValidCardCode('ABCD'), false);
assert.equal(isValidCardCode('ABCDE'), false);
assert.equal(isValidCardCode('ABCDEF'), true);
assert.equal(isValidCardCode('ab-cd ef'), true);

console.log('Grow Room Bingo card-code contract passed.');
