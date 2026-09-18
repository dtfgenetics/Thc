import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/root-cause/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/root-cause/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/root-cause/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/root-cause/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/root-cause/src/engine.mjs', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause-v2.css', 'utf8');
const responsiveCss = fs.readFileSync('site/public-route-patch/games/root-cause/root-cause-responsive-v3.css', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public Root Cause engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'Root Cause app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
assert.doesNotMatch(html, /src="\.\/engine\.js"/, 'public route must not load the duplicated browser engine');
for (const forbidden of ['function createRun(', 'function inspect(', 'function diagnose(', 'function advanceCase(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /id="inspections"/);
assert.match(html, /id="diagnoses"/);
assert.match(html, /id="case-code"/);
assert.match(html, /id="share-run"/);

assert.match(runtime, /MAX_INSPECTIONS/);
assert.match(runtime, /MAX_GUESSES/);
assert.match(runtime, /copyText\(value\)/);
assert.match(runtime, /Copy failed\. Share case code/);
assert.match(runtime, /prefers-reduced-motion: reduce/);
assert.match(runtime, /revealStackedResult/);

assert.match(baseCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visualCss, /min-height:\s*52px/);
assert.match(responsiveCss, /min-height:\s*44px/);
assert.match(responsiveCss, /body:has\(> \.dtf-global-header\) \.site-bar/);
assert.match(responsiveCss, /top:calc\(var\(--dtf-global-header-height, 92px\) \+ 88px\)/);
assert.match(responsiveCss, /@media \(forced-colors: active\)/);
assert.match(responsiveCss, /outline: 3px solid Highlight/);

console.log('Root Cause canonical engine parity, diagnostic limits, share flow, responsive shell offsets, and accessibility checks passed.');
