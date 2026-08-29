import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/lost-in-the-terps/data/puzzles.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/terps.css', 'utf8');

assert.match(html, /<script\s+id="terps-puzzle-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed puzzle data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
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

assert.match(css, /\.grid-viewport/);
assert.match(css, /\.letter\.wrong/);
assert.match(css, /\.letter\.hint/);
assert.match(css, /min-width:max\(100%,476px\)/, 'mobile grid must keep usable cell targets and scroll');
assert.match(css, /\[data-armed=true\]/, 'guarded destructive controls need a visible armed state');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

for (const puzzle of canonical.puzzles) {
  assert.equal(puzzle.words.length, 8, `${puzzle.id} must retain eight hidden words`);
  assert.equal(new Set(puzzle.words.map((item) => item.word)).size, 8, `${puzzle.id} words must be unique`);
}

console.log('Lost in the Terps public runtime, hint, mission isolation and mobile grid checks passed.');
