import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/trichome-trials/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/trichome-trials/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/trichome-trials/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/trichome-trials/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/trichome-trials/src/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/trichome-trials/trichome-trials-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/trichome-trials/data/trials.json', 'utf8'));

assert.match(html, /<script id="trichome-trials-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.match(html, /trichome-trials-v2\.css/);
assert.match(html, /id="scorecard-progress"/);

const embeddedMatch = html.match(/<script id="trichome-trials-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded judging data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded judging data must exactly match the canonical trials deck');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical Trichome Trials engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\s*\(/, 'runtime must not depend on browser-time JSON fetches');
for (const forbidden of ['function createTrial(', 'function submitScorecard(', 'function advanceTrial(', 'function scoreScorecard(', 'function trialEntryOrder(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /function submitConfidentScorecard\(/, 'confidence bonuses must remain a UI-layer extension');
assert.doesNotMatch(runtime, /CSS\.escape/, 'public score controls must not require CSS.escape');
assert.match(runtime, /let touchedIds = new Set\(\)/);
assert.match(runtime, /ui\.submit\.disabled = !judging \|\| !allReviewed/);
assert.match(runtime, /button\[data-score-step\]\[data-category\]/);
assert.match(runtime, /Review all .* categories before submitting/);
assert.match(runtime, /globalThis\.crypto\?\.getRandomValues/);
assert.match(runtime, /globalThis\.history\?\.replaceState/);
assert.match(runtime, /globalThis\.matchMedia\?\./);
assert.match(runtime, /navigator\.clipboard\?\.writeText/);
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share trial/, 'share failure must preserve the full manual challenge path');

assert.match(visual, /\.score-stepper/);
assert.match(visual, /\.score-row\.unreviewed/);
assert.match(visual, /\.score-row\.reviewed/);
assert.match(visual, /\.scorecard-progress\.complete/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('Trichome Trials canonical engine runtime and reviewed-scorecard regression checks passed.');
