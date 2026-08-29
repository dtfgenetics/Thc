import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/strain-match/data/decks.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/strain-match/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/strain-match/app.js', 'utf8');

assert.match(html, /<script\s+id="strain-match-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed deck data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embeddedMatch = html.match(/<script\s+id="strain-match-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embeddedMatch, 'embedded Strain Match data block missing');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonical, 'embedded public data must exactly match canonical decks.json');

assert.doesNotMatch(app, /fetch\(['"]\.\/data\/decks\.json/i, 'public runtime must not fetch deck JSON at runtime');
assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not require browser imports');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function isBetterResult\(/, 'runtime must compare complete best results');
assert.match(app, /const mismatched = \[\.\.\.openCards\]/, 'mismatch timeout must snapshot the two selected cards');
assert.match(app, /aria-pressed/, 'card reveal state must be exposed accessibly');

for (const deck of canonical.decks) {
  assert.equal(deck.pairs.length, 8, `${deck.id} must keep eight pairs`);
  assert.equal(new Set(deck.pairs.map((pair) => pair.id)).size, 8, `${deck.id} pair ids must remain unique`);
}

console.log('Strain Match public runtime regression checks passed.');
