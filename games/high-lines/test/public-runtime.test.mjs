import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/high-lines/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/high-lines/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/high-lines/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/high-lines/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/high-lines/src/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/high-lines/high-lines-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/high-lines/data/scenes.json', 'utf8'));

assert.match(html, /<script id="high-lines-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.match(html, /high-lines-v2\.css/);
assert.match(html, /id="zoom-out"/);
assert.match(html, /id="zoom-level"/);
assert.match(html, /id="zoom-in"/);
assert.match(html, /id="zoom-reset"/);

const embeddedMatch = html.match(/<script id="high-lines-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded High Lines data must be present');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonical, 'public embedded High Lines data must exactly match canonical scenes.json');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical High Lines engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\(['"]\.\/data\/scenes\.json/, 'runtime must not fetch scene metadata at runtime');
for (const forbidden of ['function createExperience(', 'function fillRegion(', 'function selectColor(', 'function undoFill(', 'function findHiddenObject(', 'function resetArtwork(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /function restoreExperience\(/);
assert.match(runtime, /function experienceSavePayload\(/);
assert.match(runtime, /globalThis\.localStorage\?\.setItem/);
assert.match(runtime, /globalThis\.localStorage\?\.getItem/);
assert.match(runtime, /globalThis\.localStorage\?\.removeItem/);
assert.match(runtime, /function fetchSceneText\(/);
assert.match(runtime, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
assert.match(runtime, /requestToken !== sceneLoadToken/);
assert.match(runtime, /svg\.querySelector\('script, foreignObject'\)/);
assert.match(runtime, /Confirm Reset/);
assert.match(runtime, /resetTimer = window\.setTimeout\(disarmReset, 4500\)/);
assert.match(runtime, /const MAX_ZOOM = 2\.5/);
assert.match(runtime, /svg\.style\.width = `\$\{Math\.round\(zoom \* 100\)\}%`/);
assert.match(runtime, /globalThis\.crypto\?\.getRandomValues/);
assert.match(runtime, /globalThis\.history\?\.replaceState/);
assert.match(runtime, /navigator\.clipboard\?\.writeText/);
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share scene code/, 'share failure must preserve the full manual challenge path');

assert.match(visual, /\.board-controls/);
assert.match(visual, /overflow:auto/);
assert.match(visual, /touch-action:pan-x pan-y/);
assert.match(visual, /#reset-art\.reset-armed/);
assert.match(visual, /@media\(max-width:650px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);
const baseCss = fs.readFileSync('site/public-route-patch/games/high-lines/high-lines.css', 'utf8');
assert.match(baseCss, /\.codebar button,\.tool-card button\{min-height:44px/, 'code and tool controls must retain 44px touch targets');
assert.match(baseCss, /@media\(forced-colors:active\)/, 'High Lines controls must remain visible in forced-colors mode');
assert.match(baseCss, /outline:3px solid Highlight/, 'forced-colors focus must remain visible');

console.log('High Lines canonical engine runtime, persistence and zoom UI regression checks passed.');
