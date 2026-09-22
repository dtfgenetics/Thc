import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/trichome-trials/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/trichome-trials/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/trichome-trials/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/trichome-trials/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/trichome-trials/src/engine.mjs', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/trichome-trials/trichome-trials-v2.css', 'utf8');
const confidenceCss = fs.readFileSync('site/public-route-patch/games/trichome-trials/confidence.css', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public Trichome Trials engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'Trichome Trials app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
for (const forbidden of ['function createTrial(', 'function submitScorecard(', 'function advanceTrial(', 'function scoreScorecard(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /id="scorecard"/);
assert.match(html, /id="submit-card"/);
assert.match(html, /id="benchmark-review"/);
assert.match(html, /id="next-round"/);
assert.match(html, /id="share-trial"/);

assert.match(runtime, /MAX_CONFIDENCE_CALLS = 2/);
assert.match(runtime, /EXACT_CONFIDENCE_BONUS = 6/);
assert.match(runtime, /NEAR_CONFIDENCE_BONUS = 3/);
assert.match(runtime, /Choose at most \$\{MAX_CONFIDENCE_CALLS\} confidence calls/);
assert.match(runtime, /touchedIds\.size !== data\.categories\.length/);
assert.match(runtime, /copyText\(text\)/);
assert.match(runtime, /Copy failed\. Share trial/);
assert.match(runtime, /safeFocus\(ui\.review\)/);
assert.match(runtime, /safeFocus\(ui\.sample\)/);
assert.match(runtime, /tabindex', '-1'/);

assert.match(css, /\.confidence-button\{min-height:44px/);
assert.match(css, /\.score-stepper button\{[^}]*width:44px;height:44px/);
assert.match(css, /@media\(max-width:640px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /@media\(forced-colors:active\)/);
assert.match(css, /outline:3px solid Highlight/);
assert.match(confidenceCss, /aria-pressed="true"/);

console.log('Trichome Trials canonical engine parity, confidence scoring, complete review, focus flow, sharing, touch sizing, and accessibility checks passed.');
