import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/terpocalypse/index.html', 'utf8');
const main = fs.readFileSync('site/public-route-patch/games/terpocalypse/main.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/terpocalypse/styles.css', 'utf8');
const mobileCss = fs.readFileSync('site/public-route-patch/games/terpocalypse/mobile-gameplay-v2.css', 'utf8');
const visibilityPause = fs.readFileSync('site/public-route-patch/games/terpocalypse/visibility-pause-v1.js', 'utf8');
const sourceRevision = fs.readFileSync('site/public-route-patch/games/terpocalypse/source-revision.txt', 'utf8');

assert.match(html, /LEVEL 01 · THE VEG LAB/);
assert.match(html, /Original DTF Genetics browser action game/);
assert.match(html, /visibility-pause-v1\.js/);
assert.match(html, /mobile-gameplay-v2\.css/);
assert.match(html, /class="mission-briefing"/);
assert.match(html, /Clear threats/);
assert.match(html, /Find keycard/);
assert.match(html, /Extract/);
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
assert.match(css, /\.mission-briefing\{/);
assert.match(mobileCss, /--terp-mobile-hud-reserve: 96px/);
assert.match(mobileCss, /bottom: calc\(var\(--terp-mobile-hud-reserve\)/);
assert.match(visibilityPause, /releaseHeldKeyboardControls/);
assert.match(visibilityPause, /visibilitychange/);
assert.match(sourceRevision, /repository=dtfgenetics\/Terpocalapse/);
assert.match(sourceRevision, /commit=112c4c78ed53eaeb433d50dfe87d43f05746d233/);

console.log('Terpocalypse public runtime contracts passed.');
