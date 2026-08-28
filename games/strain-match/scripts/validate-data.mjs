import fs from 'node:fs';
import assert from 'node:assert/strict';

const canonicalPath = new URL('../data/decks.json', import.meta.url);
const publicPath = new URL('../../../site/public-route-patch/games/strain-match/data/decks.json', import.meta.url);
const canonicalText = fs.readFileSync(canonicalPath, 'utf8');
const publicText = fs.readFileSync(publicPath, 'utf8');
const data = JSON.parse(canonicalText);

assert.equal(data.schemaVersion, 1, 'Unexpected Strain Match schema version');
assert.equal(data.decks.length, 4, 'First release must contain four decks');
assert.equal(canonicalText.trim(), publicText.trim(), 'Public Strain Match data drifted from canonical data');

const deckIds = new Set();
for (const deck of data.decks) {
  assert.match(deck.id, /^[a-z0-9-]+$/, `Invalid deck id: ${deck.id}`);
  assert.ok(!deckIds.has(deck.id), `Duplicate deck id: ${deck.id}`);
  deckIds.add(deck.id);
  assert.ok(deck.title && deck.description, `Deck ${deck.id} needs title and description`);
  assert.equal(deck.pairs.length, 8, `Deck ${deck.id} must contain eight pairs`);
  const pairIds = new Set();
  for (const pair of deck.pairs) {
    assert.ok(pair.id && pair.term && pair.clue && pair.note, `Incomplete pair in ${deck.id}`);
    assert.ok(!pairIds.has(pair.id), `Duplicate pair id ${pair.id} in ${deck.id}`);
    pairIds.add(pair.id);
    assert.notEqual(pair.term.trim().toLowerCase(), pair.clue.trim().toLowerCase(), `Pair ${pair.id} must require matching, not identical text`);
  }
}

console.log(`Strain Match data valid: ${data.decks.length} decks, ${data.decks.reduce((sum, deck) => sum + deck.pairs.length, 0)} educational pairs.`);
