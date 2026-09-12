import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/lost-in-the-terps/data/puzzles.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/app.js', 'utf8');
const keyboard = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/keyboard-nav-v1.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/terps.css', 'utf8');

assert.match(html, /<script\s+id="terps-puzzle-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed puzzle data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.match(html, /<script\s+src="\.\/keyboard-nav-v1\.js"\s+defer><\/script>/i, 'public page must load grid keyboard navigation after app.js');
assert.match(html, /Keyboard: use arrow keys to move around the grid/i, 'player instructions must expose grid keyboard controls');
assert.match(html, /aria-label="Word search grid\. Use arrow keys to move between letters\."/i, 'grid accessible name must explain arrow navigation');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="terps-puzzle-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded puzzle data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public puzzle data must exactly match canonical puzzles.json');

assert.doesNotMatch(app, /fetch\(['"]\.\/data\/puzzles\.json/i, 'public runtime must not fetch puzzle JSON at runtime');
assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not require browser imports');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function validateData\(/, 'runtime must validate embedded puzzle coordinates');
assert.match(app, /globalThis\.history\?\.replaceState/, 'runtime must preserve shareable mission URLs safely');
assert.match(app, /let missionToken = 0;/, 'mission token must isolate delayed hint and error feedback');
assert.match(app, /if \(token !== missionToken\) return;/, 'stale delayed callbacks must not mutate a new mission');
assert.match(app, /function useHint\(/, 'runtime must provide limited hint gameplay');
assert.match(app, /hintsRemaining = 3/, 'each mission must begin with three hints');
assert.match(app, /function requestMission\(/, 'mission changes with progress must be guarded');
assert.match(app, /function requestReset\(/, 'mission reset with progress must be guarded');
assert.match(app, /function showWrongPath\(/, 'wrong selections must provide board-level feedback');
assert.match(app, /classList\.add\('wrong'\)/, 'wrong path cells must be marked');
assert.match(app, /grid-viewport/, 'runtime must wrap large grids in a scrollable mobile viewport');
assert.match(app, /event\.key === 'Escape'/, 'runtime must allow keyboard cancellation of a start selection');
assert.match(app, /event\.key === 'h' \|\| event\.key === 'H'/, 'H keyboard shortcut must activate a hint');
assert.match(app, /aria-pressed/, 'runtime must expose selected and found cell state');

assert.match(keyboard, /lost-in-the-terps-keyboard-nav-v1/, 'keyboard layer must expose a stable version');
assert.match(keyboard, /ArrowLeft/, 'keyboard layer must support left grid navigation');
assert.match(keyboard, /ArrowRight/, 'keyboard layer must support right grid navigation');
assert.match(keyboard, /ArrowUp/, 'keyboard layer must support up grid navigation');
assert.match(keyboard, /ArrowDown/, 'keyboard layer must support down grid navigation');
assert.match(keyboard, /event\.key === 'Home'/, 'keyboard layer must support row-start navigation');
assert.match(keyboard, /event\.key === 'End'/, 'keyboard layer must support row-end navigation');
assert.match(keyboard, /cell\.tabIndex = cell === focusable \? 0 : -1/, 'grid must use roving tabindex instead of adding every letter to the page tab order');
assert.match(keyboard, /function keepCellVisible\(/, 'navigation layer must share one viewport visibility helper');
assert.match(keyboard, /scrollIntoView\(\{[\s\S]*block: 'nearest',[\s\S]*inline: 'nearest'/, 'grid navigation and hints must stay inside the nearest mobile viewport area');
assert.match(keyboard, /prefers-reduced-motion: reduce/, 'hint visibility scrolling must respect reduced-motion preference');
assert.match(keyboard, /target\.matches\('button\.letter\.hint'\)/, 'hint class changes must bring the highlighted start cell into view');
assert.match(keyboard, /keepCellVisible\(target, \{ emphasize: true \}\)/, 'hint visibility must request the emphasized viewport behavior');
assert.match(keyboard, /hintVisibility: true/, 'diagnostics must expose the mobile hint-visibility contract');
assert.match(keyboard, /complete\.focus\(\{ preventScroll: true \}\)/, 'mission completion must move focus to the completion summary');
assert.match(keyboard, /MutationObserver/, 'keyboard semantics must be restored after mission grid rerenders');

assert.match(css, /\.grid-viewport/);
assert.match(css, /\.letter\.start/, 'first-letter selection must have a strong dedicated visual state');
assert.match(css, /\.letter\.found/, 'found paths must have a dedicated visual state');
assert.match(css, /\.letter\.wrong/, 'wrong selections must remain clearly visible');
assert.match(css, /\.letter\.hint/, 'hinted start cells must remain clearly visible');
assert.match(css, /\.word\.found::before\{content:"✓"/, 'found word-list items must have a completion marker');
assert.match(css, /\.play aside\{position:static\}/, 'mobile support panel must stop using desktop sticky behavior');
assert.match(css, /aside\{position:sticky;top:84px/, 'desktop word list must stay available while scanning the grid');
assert.match(css, /min-width:max\(100%,476px\)/, 'mobile grid must keep usable cell targets and scroll');
assert.match(css, /\[data-armed=true\]/, 'guarded destructive controls need a visible armed state');
assert.match(css, /@media\(hover:none\)/, 'touch devices must not inherit hover-only movement');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'word-search polish must respect reduced-motion preferences');

for (const puzzle of canonical.puzzles) {
  assert.equal(puzzle.words.length, 8, `${puzzle.id} must retain eight hidden words`);
  assert.equal(new Set(puzzle.words.map((item) => item.word)).size, 8, `${puzzle.id} words must be unique`);
}

console.log('Lost in the Terps public runtime, keyboard grid navigation, visual selection states, visible hints, mission isolation and mobile grid checks passed.');
