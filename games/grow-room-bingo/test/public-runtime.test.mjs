import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grow-room-bingo/data/prompts.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/app.js', 'utf8');
const nav = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/keyboard-nav.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/bingo.css', 'utf8');

assert.match(html, /<script\s+id="bingo-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed bingo data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.match(html, /<script\s+src="\.\/keyboard-nav\.js"\s+defer><\/script>/i, 'public page must load keyboard navigation as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');
assert.match(html, /class="bingo-columns"/i, 'public board must expose the BINGO column marquee');
assert.match(html, /id="progress-fill"/i, 'public HUD must expose visual card progress');
assert.match(html, /class="board-stage"/i, 'public playfield must use the dedicated board stage');
assert.match(html, /Use arrow keys to move between playable squares/i, 'board accessibility copy must document directional navigation');
assert.match(html, /center FREE space is skipped automatically/i, 'player instructions must explain FREE-space keyboard behavior');

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
assert.match(app, /document\.documentElement\.dataset\.mode = mode/, 'selected mode must drive the game visual theme');
assert.match(app, /progressFill\.style\.width/, 'marking must update the visual completion meter');
assert.match(app, /progressRail\.setAttribute\('aria-valuenow'/, 'visual progress must remain accessible');
assert.match(app, /board\.dataset\.lines/, 'completed line count must be exposed to the board presentation layer');

assert.doesNotMatch(nav, /^\s*import\s/m, 'keyboard navigation must remain hosting-safe without browser imports');
assert.match(nav, /const SIZE = 5;/, 'keyboard navigation must preserve the 5x5 board geometry');
assert.match(nav, /function makeRoving\(/, 'keyboard navigation must use a roving tabindex');
assert.match(nav, /cell\.tabIndex = cell === focusable \? 0 : -1/, 'only one playable square should remain in the Tab order');
assert.match(nav, /ArrowLeft: -1/, 'left-arrow navigation must be supported');
assert.match(nav, /ArrowRight: 1/, 'right-arrow navigation must be supported');
assert.match(nav, /ArrowUp: -SIZE/, 'up-arrow navigation must be supported');
assert.match(nav, /ArrowDown: SIZE/, 'down-arrow navigation must be supported');
assert.match(nav, /event\.key === 'Home'/, 'Home must move to the first playable cell in the row');
assert.match(nav, /event\.key === 'End'/, 'End must move to the last playable cell in the row');
assert.match(nav, /if \(!target \|\| target\.disabled\) return false;/, 'directional movement must skip the disabled FREE center');
assert.match(nav, /MutationObserver/, 'roving tabindex must refresh after card rerenders');
assert.match(nav, /scrollIntoView\?\./, 'keyboard focus must remain visible on constrained/mobile layouts');

assert.match(css, /\.controls button\[data-armed=true\]/, 'clear confirmation must have visible armed styling');
assert.match(css, /\.board\.has-bingo/, 'completed bingo state must have board-level feedback');
assert.match(css, /\.cell\.mark-pop/, 'mark interactions must have immediate visual feedback');
assert.match(css, /\.cell\[aria-pressed=true\]:not\(\.free\)::after/, 'marked mobile cells must include a strong check indicator');
assert.match(css, /\.bingo-columns/, 'BINGO column labels must have dedicated styling');
assert.match(css, /\.progress-rail/, 'card completion must have a dedicated progress treatment');
assert.match(css, /html\[data-mode=bongwater\]/, 'Bongwater mode must have its own visual identity');
assert.match(css, /html\[data-mode=mixed\]/, 'Mixed mode must have its own visual identity');
assert.match(css, /@media\(max-width:430px\)/, 'small-screen bingo controls must be explicitly tuned');
assert.match(css, /@media\(hover:none\)/, 'touch devices must not inherit hover-only movement');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'motion feedback must respect reduced-motion preferences');

const modeIds = new Set(canonical.modes.map((item) => item.id));
assert.ok(modeIds.has('grow-room') && modeIds.has('bongwater') && modeIds.has('mixed'), 'all three bingo modes must remain available');
for (const mode of canonical.modes.filter((item) => item.id !== 'mixed')) {
  const prompts = canonical.prompts.filter((prompt) => prompt.mode === mode.id);
  assert.ok(prompts.length >= 24, `${mode.id} must contain at least 24 prompts`);
}
assert.ok(canonical.prompts.length >= 48, 'mixed mode must have a full prompt pool');

console.log('Grow Room Bingo public runtime, saved-card persistence, keyboard navigation and mobile feedback checks passed.');
