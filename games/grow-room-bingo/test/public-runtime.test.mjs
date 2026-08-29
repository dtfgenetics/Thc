import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grow-room-bingo/data/prompts.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/bingo.css', 'utf8');

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
assert.match(app, /globalThis\.history\?\.replaceState/, 'public runtime must keep shareable card URLs safely');

assert.match(app, /const SAVE_VERSION = 1;/, 'saved-card payloads must be versioned');
assert.match(app, /const SAVE_PREFIX = 'dtf-bingo-card-v1:';/, 'saved-card keys must be namespaced');
assert.match(app, /function saveKey\(/, 'card progress must be keyed by mode and code');
assert.match(app, /function readSavedMarks\(/, 'runtime must restore saved marks');
assert.match(app, /function persistMarks\(/, 'runtime must autosave marks after interaction');
assert.match(app, /function validMarkedIndex\(/, 'restored mark indexes must be validated');
assert.match(app, /marks\.add\(12\)/, 'FREE center must always be restored as marked');
assert.match(app, /globalThis\.localStorage\?\.setItem/, 'autosave must tolerate restricted local storage');
assert.match(app, /globalThis\.localStorage\?\.getItem/, 'restore must tolerate restricted local storage');
assert.match(app, /globalThis\.localStorage\?\.removeItem/, 'clear and invalid-save cleanup must tolerate restricted local storage');
assert.match(app, /clearButton\.id = 'clear-marks'/, 'runtime must expose an explicit clear-marks action');
assert.match(app, /clearArmedUntil/, 'clearing saved marks must require confirmation once progress exists');
assert.match(app, /Saved progress restored for card/, 'returning to a card must announce restored progress');
assert.match(app, /Progress saved on this device/, 'marking must disclose autosave state');
assert.match(app, /aria-pressed/, 'mark state must remain exposed to assistive technology');

assert.match(css, /\.controls button\[data-armed=true\]/, 'clear confirmation must have visible armed styling');
assert.match(css, /\.board\.has-bingo/, 'completed bingo state must have board-level feedback');
assert.match(css, /\.cell\.mark-pop/, 'mark interactions must have immediate visual feedback');
assert.match(css, /\.cell\[aria-pressed=true\]:not\(\.free\)::after/, 'marked mobile cells must include a strong check indicator');
assert.match(css, /@media\(max-width:430px\)/, 'small-screen bingo controls must be explicitly tuned');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'motion feedback must respect reduced-motion preferences');

const modeIds = new Set(canonical.modes.map((item) => item.id));
assert.ok(modeIds.has('grow-room') && modeIds.has('bongwater') && modeIds.has('mixed'), 'all three bingo modes must remain available');
for (const mode of canonical.modes.filter((item) => item.id !== 'mixed')) {
  const prompts = canonical.prompts.filter((prompt) => prompt.mode === mode.id);
  assert.ok(prompts.length >= 24, `${mode.id} must contain at least 24 prompts`);
}
assert.ok(canonical.prompts.length >= 48, 'mixed mode must have a full prompt pool');

console.log('Grow Room Bingo public runtime, saved-card persistence and mobile feedback checks passed.');
