import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grow-room-bingo/data/prompts.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/app.js', 'utf8');

assert.match(html, /<script\s+id="bingo-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed bingo data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embeddedMatch = html.match(/<script\s+id="bingo-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embeddedMatch, 'embedded bingo data block missing');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'embedded public data must exactly match canonical prompts.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/prompts\.json/i, 'public runtime must not fetch prompt JSON at runtime');
assert.match(app, /function readEmbeddedData\(/, 'public runtime must read embedded data');
assert.match(app, /function normalizeCardCode\(/, 'public runtime must include card-code normalization');
assert.match(app, /function isValidCardCode\(/, 'public runtime must include card-code validation');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'public runtime must guard random-code generation');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'public runtime must guard clipboard access');
assert.match(app, /history\.replaceState/, 'public runtime must keep shareable card URLs');

const modeIds = new Set(canonical.modes.map((item) => item.id));
assert.ok(modeIds.has('grow-room') && modeIds.has('bongwater') && modeIds.has('mixed'), 'all three bingo modes must remain available');
for (const mode of canonical.modes.filter((item) => item.id !== 'mixed')) {
  const prompts = canonical.prompts.filter((prompt) => prompt.mode === mode.id);
  assert.ok(prompts.length >= 24, `${mode.id} must contain at least 24 prompts`);
}
assert.ok(canonical.prompts.length >= 48, 'mixed mode must have a full prompt pool');

console.log('Grow Room Bingo public runtime regression checks passed.');
