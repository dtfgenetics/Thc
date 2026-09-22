import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/app.js', 'utf8');
const keyboard = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/keyboard-nav-v1.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/terps.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/lost-in-the-terps/data/puzzles.json', 'utf8'));
const publicData = JSON.parse(fs.readFileSync('site/public-route-patch/games/lost-in-the-terps/data/puzzles.json', 'utf8'));

assert.deepEqual(publicData, canonical, 'public Lost in the Terps puzzle data must match canonical source');
assert.equal(canonical.puzzles.length, 3);
assert.ok(canonical.puzzles.every((puzzle) => puzzle.words.length === 8));

assert.match(html, /id="grid"/);
assert.match(html, /id="missions"/);
assert.match(html, /id="reset"/);
assert.match(html, /keyboard-nav-v1\.js/);
assert.match(html, /H for a hint/);
assert.match(html, /Escape to clear the current start/);

assert.match(app, /hintsRemaining = 3/);
assert.match(app, /Confirm reset/);
assert.match(app, /Tap that mission again within 3\.5 seconds/);
assert.match(app, /minimumTouchGridWidth = puzzle\.size \* 36/);
assert.match(app, /gridEl\.style\.minWidth/);
assert.match(app, /event\.key === 'Escape'/);
assert.match(app, /event\.key === 'h' \|\| event\.key === 'H'/);
assert.match(app, /history\?\.replaceState|history\.replaceState/);

assert.match(keyboard, /ArrowLeft/);
assert.match(keyboard, /ArrowRight/);
assert.match(keyboard, /ArrowUp/);
assert.match(keyboard, /ArrowDown/);
assert.match(keyboard, /event\.key === 'Home'/);
assert.match(keyboard, /event\.key === 'End'/);
assert.match(keyboard, /tabIndex = cell === focusable \? 0 : -1/);
assert.match(keyboard, /prefers-reduced-motion: reduce/);
assert.match(keyboard, /complete\.focus\(\{ preventScroll: true \}\)/);

assert.match(css, /min-height:46px/);
assert.match(css, /touch-action:manipulation/);
assert.match(css, /@media\(max-width:820px\)/);
assert.match(css, /@media\(max-width:560px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /outline:3px solid var\(--gold\)/);

console.log('Lost in the Terps puzzle parity, reset/hint safeguards, keyboard navigation, touch-grid sizing, and accessibility checks passed.');
