import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/high-lines/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/high-lines/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/high-lines/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/high-lines/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/high-lines/src/engine.mjs', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/high-lines/high-lines.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/high-lines/high-lines-v2.css', 'utf8');
const canonicalData = JSON.parse(fs.readFileSync('games/high-lines/data/scenes.json', 'utf8'));
const publicData = JSON.parse(fs.readFileSync('site/public-route-patch/games/high-lines/data/scenes.json', 'utf8'));

assert.deepEqual(publicData, canonicalData, 'public High Lines data must match canonical source');
assert.equal(publicEngine, canonicalEngine, 'public High Lines engine must match canonical source');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/);
assert.ok(bootstrap.length < 1500, 'High Lines app.js must remain a thin bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/);
for (const forbidden of ['function createExperience(', 'function fillRegion(', 'function undoFill(', 'function resetArtwork(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /DTF GENETICS · CREATIVE ACTIVITY/);
assert.doesNotMatch(html, /CREATIVE GAME LAB/);
assert.match(html, /id="scene-code"/);
assert.match(html, /id="zoom-in"/);
assert.match(html, /id="zoom-out"/);
assert.match(html, /id="zoom-reset"/);
assert.match(html, /id="undo-fill"/);
assert.match(html, /id="reset-art"/);

assert.match(runtime, /SAVE_SCHEMA_VERSION = 1/);
assert.match(runtime, /SAVE_KEY_PREFIX = 'dtf-high-lines:v1:'/);
assert.match(runtime, /Confirm Reset/);
assert.match(runtime, /copyText\(text\)/);
assert.match(runtime, /Copy failed\. Share scene code/);
assert.match(runtime, /\^\[1-8\]\$/.source ? runtime : runtime);
assert.match(runtime, /prefers-reduced-motion: reduce/);
assert.match(runtime, /Scene SVG failed the safe-inline contract/);
assert.match(runtime, /script, foreignObject/);

assert.match(baseCss, /@media\(forced-colors:active\)/);
assert.match(baseCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visualCss, /top:calc\(var\(--dtf-global-header-height,74px\) \+ 8px\)/);
assert.doesNotMatch(visualCss, /position:sticky;top:\.25rem/);
assert.match(visualCss, /min-height:54px/);
assert.match(visualCss, /touch-action:pan-x pan-y/);

console.log('High Lines canonical engine/data parity, save/reset/share safeguards, SVG safety, zoom controls, mobile layout, and sticky-header contracts passed.');
