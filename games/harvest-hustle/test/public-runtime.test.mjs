import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/harvest-hustle/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/harvest-hustle/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/harvest-hustle/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/harvest-hustle/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/harvest-hustle/src/engine.mjs', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle-v2.css', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public Harvest Hustle engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'Harvest Hustle app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
for (const forbidden of ['function createShift(', 'function applyStation(', 'function advanceTime(', 'function shiftRank(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /75-second runs/);
assert.match(html, /id="start-shift"/);
assert.match(html, /role="progressbar"/);
assert.match(html, /Q<\/kbd>–<kbd>R/);
assert.match(html, /1<\/kbd>–<kbd>4/);

assert.match(runtime, /BATCH_KEYS = \['q', 'w', 'e', 'r'\]/);
assert.match(runtime, /document\.addEventListener\('visibilitychange'/);
assert.match(runtime, /stopClock\(\)/);
assert.match(runtime, /startClock\(\)/);
assert.match(runtime, /Pause Shift/);
assert.match(runtime, /Resume Shift/);
assert.match(runtime, /copyText\(text\)/);
assert.match(runtime, /Copy failed\. Share shift code/);
assert.match(runtime, /window\.addEventListener\('pagehide', stopClock\)/);

assert.match(baseCss, /@media\(forced-colors:active\)/);
assert.match(baseCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visualCss, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 8px\)/);
assert.doesNotMatch(visualCss, /\.selected-batch\{position:sticky;top:64px/);
assert.match(visualCss, /min-height:82px/);
assert.match(visualCss, /@media\(prefers-reduced-motion:reduce\)/);

console.log('Harvest Hustle canonical engine parity, deterministic clock, pause/resume, shortcuts, share flow, mobile controls, and sticky-header contracts passed.');
