import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/harvest-hustle/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/harvest-hustle/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/harvest-hustle/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/harvest-hustle/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/harvest-hustle/src/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/harvest-hustle/data/shift.json', 'utf8'));

assert.match(html, /<script id="harvest-shift-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.match(html, /harvest-hustle-v2\.css/);
assert.match(html, /id="shift-progress-fill"/);
assert.match(html, /id="control-state"/);

const embeddedMatch = html.match(/<script id="harvest-shift-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded shift data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded shift data must exactly match canonical shift data');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical Harvest Hustle engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\s*\(/, 'runtime must not depend on browser-time JSON fetches');
assert.match(runtime, /function validateData\(/);
for (const forbidden of ['function createShift(', 'function applyStation(', 'function batchIdForIndex(', 'function advanceTime(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /if \(running\) \{[\s\S]*Shift paused/);
assert.match(runtime, /ui\.start\.textContent = state\.status === 'complete' \? 'Shift Complete' : running \? 'Pause Shift' : state\.elapsed > 0 \? 'Resume Shift' : 'Start Shift'/);
assert.match(runtime, /ui\.code\.disabled = running/);
assert.match(runtime, /clockId = window\.setInterval\(settleClock, 250\)/);
assert.match(runtime, /navigator\.vibrate/);
assert.match(runtime, /navigator\.clipboard\?\.writeText/, 'share behavior must guard clipboard access');
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share shift code/, 'share failure must retain the full manual challenge path');
assert.match(runtime, /next-station/);
assert.match(runtime, /document\.addEventListener\('visibilitychange'/);

assert.match(visual, /\.shift-progress/);
assert.match(visual, /\.timer-critical/);
assert.match(visual, /\.combo-hot/);
assert.match(visual, /\.station-button\.next-station/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle.css','utf8'), /@media\(forced-colors:active\)/);
assert.match(fs.readFileSync('site/public-route-patch/games/harvest-hustle/harvest-hustle.css','utf8'), /outline:3px solid Highlight/);

console.log('Harvest Hustle canonical engine runtime and arcade UI regression checks passed.');
