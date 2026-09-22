import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/app.js', 'utf8');
const keyboard = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/keyboard-nav.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/grow-room-bingo/bingo.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/grow-room-bingo/data/prompts.json', 'utf8'));
const publicData = JSON.parse(fs.readFileSync('site/public-route-patch/games/grow-room-bingo/data/prompts.json', 'utf8'));

assert.deepEqual(publicData, canonical, 'public Bingo prompt data must match canonical source');
assert.equal(canonical.prompts.length, 60);
assert.deepEqual(canonical.modes.map((mode) => mode.id), ['grow-room', 'bongwater', 'mixed']);

assert.match(html, /id="board"/);
assert.match(html, /id="code"/);
assert.match(html, /id="copy"/);
assert.match(html, /id="progress-label"/);
assert.match(html, /role="progressbar"/);
assert.match(html, /keyboard-nav\.js/);
assert.match(html, /Your marks save on this device/);

assert.match(app, /const SAVE_VERSION = 1/);
assert.match(app, /const SAVE_PREFIX = 'dtf-bingo-card-v1:'/);
assert.match(app, /new Set\(\[12\]\)/, 'center FREE space must remain pre-marked');
assert.match(app, /const patterns = \[/);
assert.match(app, /persistMarks\(\)/);
assert.match(app, /Confirm clear/);
assert.match(app, /copyText\(text\)/);
assert.match(app, /Copy failed\. Share card code/);
assert.match(app, /crypto\?\.getRandomValues|crypto\.getRandomValues/);
assert.match(app, /history\?\.replaceState|history\.replaceState/);

assert.match(keyboard, /const SIZE = 5/);
assert.match(keyboard, /ArrowLeft/);
assert.match(keyboard, /ArrowRight/);
assert.match(keyboard, /ArrowUp/);
assert.match(keyboard, /ArrowDown/);
assert.match(keyboard, /event\.key === 'Home'/);
assert.match(keyboard, /event\.key === 'End'/);
assert.match(keyboard, /tabIndex = cell === focusable \? 0 : -1/);

assert.match(css, /min-height:46px/);
assert.match(css, /touch-action:manipulation/);
assert.match(css, /@media\(max-width:680px\)/);
assert.match(css, /@media\(max-width:430px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /outline:3px solid var\(--green\)/);

console.log('Grow Room Bingo data parity, autosave, share flow, keyboard navigation, mobile layout, and accessibility checks passed.');
