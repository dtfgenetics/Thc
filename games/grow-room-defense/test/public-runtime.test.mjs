import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/grow-room-defense/index.html', 'utf8');
const bootstrap = fs.readFileSync('site/public-route-patch/games/grow-room-defense/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/grow-room-defense/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/grow-room-defense/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/grow-room-defense/src/engine.mjs', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/grow-room-defense.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/grow-room-defense-v2.css', 'utf8');
const accessibilityCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/accessibility-v1.css', 'utf8');
const accessibilityJs = fs.readFileSync('site/public-route-patch/games/grow-room-defense/accessibility-v1.js', 'utf8');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match canonical Grow Room Defense engine');
assert.match(bootstrap, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(bootstrap.length < 1500, 'app.js must remain a thin compatibility bootstrap');

assert.match(runtime, /from '\.\/engine\.mjs';/, 'browser runtime must import canonical public engine');
for (const forbidden of [
  'function createGame(',
  'function applyAction(',
  'function counterQuality(',
  'function counterPower(',
  'function spawnThreat('
]) {
  assert.equal(runtime.includes(forbidden), false, `browser runtime must not duplicate canonical rules: ${forbidden}`);
}

assert.match(html, /grow-room-defense-v2\.css/);
assert.match(html, /accessibility-v1\.css/);
assert.match(html, /accessibility-v1\.js/);
assert.match(html, /id="lanes"/);
assert.match(html, /id="tools"/);
assert.match(html, /id="defense-code"/);
assert.match(html, /id="share-run"/);

assert.match(baseCss, /touch-action:manipulation/);
assert.match(baseCss, /:focus-visible/);
assert.match(baseCss, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(visualCss, /min-height:46px/);
assert.match(accessibilityCss, /@media\(forced-colors:active\)/);
assert.match(accessibilityJs, /aria-keyshortcuts/);
assert.match(accessibilityJs, /role', 'progressbar'/);
assert.match(accessibilityJs, /prefers-reduced-motion: reduce/);

assert.match(runtime, /copyText\(text\)/, 'challenge sharing must retain fallback copy support');
assert.match(runtime, /Copy failed\. Share defense code/, 'failed clipboard copy must leave usable fallback text');
assert.match(runtime, /priority targeting/, 'load status must describe current targeting behavior');

console.log('Grow Room Defense canonical engine parity, browser runtime, mobile controls, sharing, and accessibility checks passed.');
