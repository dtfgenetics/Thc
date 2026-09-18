import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/terpocalypse/index.html', 'utf8');
const main = fs.readFileSync('site/public-route-patch/games/terpocalypse/main.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/terpocalypse/styles.css', 'utf8');

assert.match(html, /LEVEL 01 · THE VEG LAB/);
assert.match(html, /Original DTF Genetics browser action game/);
assert.match(html, /visibility-pause-v1\.js/);
assert.doesNotMatch(html, /playable browser prototype/i);
assert.doesNotMatch(html, /user-scalable=no/);

assert.match(main, /mode==="running"\|\|mode==="paused"/);
assert.match(main, /mode=mode==="running"\?"paused":"running"/);
assert.match(css, /\.hub-back,\.sound-toggle\{min-height:44px/);
assert.match(css, /\.touch-right \.small-action\{height:44px/);
assert.match(css, /\.touch-right>div:first-child button\{height:44px/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /outline:3px solid Highlight/);

console.log('Terpocalypse public runtime contracts passed.');
