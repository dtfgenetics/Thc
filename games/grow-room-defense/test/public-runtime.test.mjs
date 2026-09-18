import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grow-room-defense/data/ipm.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grow-room-defense/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-defense/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/grow-room-defense/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/grow-room-defense/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/grow-room-defense/src/engine.mjs', 'utf8');
const accessibility = fs.readFileSync('site/public-route-patch/games/grow-room-defense/accessibility-v1.js', 'utf8');
const baseCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/grow-room-defense.css', 'utf8');
const visualCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/grow-room-defense-v2.css', 'utf8');
const accessibilityCss = fs.readFileSync('site/public-route-patch/games/grow-room-defense/accessibility-v1.css', 'utf8');

assert.match(html, /<script\s+id="grow-room-defense-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed IPM game data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.match(html, /<script\s+src="\.\/accessibility-v1\.js"\s+defer><\/script>/i, 'public page must load the accessibility enhancement after the game runtime');
assert.match(html, /accessibility-v1\.css/i, 'public page must load visible shortcut styling');
assert.match(html, /Keyboard shortcuts 1 through 7 select tools in order/i, 'tool group must explain keyboard selection');
assert.match(html, /grow-room-defense-v2\.css/i, 'public page must load the V2 tactical visual layer');

const embedded = html.match(/<script\s+id="grow-room-defense-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded defense data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public defense data must exactly match canonical ipm.json');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical Grow Room Defense engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\(['"]\.\/data\/ipm\.json/i, 'runtime must not fetch IPM JSON at runtime');
assert.match(runtime, /function readEmbeddedData\(/, 'runtime must read embedded defense data');
assert.match(runtime, /function validateData\(/, 'runtime must validate embedded defense data');
for (const forbidden of ['function createGame(', 'function applyAction(', 'function counterQuality(', 'function counterPower(', 'function spawnThreat(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /function renderThreat\(active, laneId, tool, laneAlive\)/, 'threat rendering must know whether the bench is alive');
assert.match(runtime, /!tool \|\| !laneAlive \|\| state\.status !== 'playing'/, 'dead bench threat buttons must be disabled');
assert.match(runtime, /const laneAlive = lane\.health > 0/, 'lane render must derive targetability from health');
assert.match(runtime, /button\.deploy-button\[data-lane\]/, 'bench click delegation must target deploy buttons explicitly');
assert.match(runtime, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(runtime, /function safeReplaceUrl\(/, 'history mutation must be guarded');
assert.match(runtime, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share defense code/, 'share failure must preserve the full manual challenge path');

assert.match(accessibility, /grow-room-defense-accessibility-v1/, 'accessibility layer must expose a stable version marker');
assert.match(accessibility, /role', 'progressbar'/, 'plant health tracks must become semantic progressbars');
assert.match(accessibility, /aria-valuenow/, 'plant health meters must expose current health values');
assert.match(accessibility, /aria-keyshortcuts/, 'IPM tool buttons must expose keyboard shortcuts');
assert.match(accessibility, /\^\[1-7\]\$/, 'keyboard handler must be limited to the seven tool shortcuts');
assert.match(accessibility, /closest\('input, textarea, select, \[contenteditable="true"\]'\)/, 'tool shortcuts must not steal input while typing');
assert.match(accessibility, /MutationObserver/, 'accessibility semantics must be restored after deterministic rerenders');
assert.match(accessibility, /\(max-width: 980px\) and \(pointer: coarse\)/, 'mobile return behavior must be limited to compact coarse-pointer layouts');
assert.match(accessibility, /event\.detail === 0/, 'keyboard-generated tool clicks must not trigger touch auto-scroll');
assert.match(accessibility, /requestAnimationFrame/, 'mobile return must wait for the core tool-selection rerender');
assert.match(accessibility, /lanes\.scrollIntoView/, 'touch tool selection must return the player to the bench board');
assert.match(accessibility, /prefers-reduced-motion: reduce/, 'mobile return must honor reduced-motion preference');
assert.match(accessibility, /lanes\.style\.scrollMarginTop = '88px'/, 'mobile return must clear the sticky site header');
assert.match(accessibility, /mobileToolReturn: true/, 'enhancement contract must expose mobile tool return');
assert.match(accessibilityCss, /\.tool-shortcut/, 'visible shortcut badges must have styling');
assert.match(accessibilityCss, /@media\(forced-colors:active\)/, 'defense controls must remain visible in forced-colors mode');
assert.match(accessibilityCss, /outline:3px solid Highlight/, 'forced-colors focus must remain visible');

assert.match(baseCss, /\.lane-card\.lost/, 'lost bench state must remain represented by the base game layer');
assert.match(baseCss, /\.feedback-card\.strong/, 'strong counter feedback must remain represented by the base game layer');
assert.match(baseCss, /\.feedback-card\.supportive/, 'supportive counter feedback must remain represented by the base game layer');
assert.match(baseCss, /\.feedback-card\.mismatch/, 'mismatch feedback must remain represented by the base game layer');

assert.match(visualCss, /\.hero::before\{[\s\S]*DEFENSE \/\/ 12 ROUNDS/, 'V2 hero must expose the tactical run identity');
assert.match(visualCss, /\.lane-card:has\(\.threat-card\)/, 'benches under active pressure must gain stronger visual urgency');
assert.match(visualCss, /\.lane-card\.lost::after/, 'lost benches must expose a direct status marker');
assert.match(visualCss, /\.pressure-pip\.active/, 'active threat pressure must have a stronger meter treatment');
assert.match(visualCss, /\.tool-button\[aria-pressed="true"\]/, 'selected IPM tool must be visually unmistakable');
assert.match(visualCss, /\.feedback-card\.strong/, 'strong response must receive V2 result emphasis');
assert.match(visualCss, /\.feedback-card\.supportive/, 'supportive response must receive V2 result emphasis');
assert.match(visualCss, /\.feedback-card\.mismatch/, 'mismatch response must receive V2 result emphasis');
assert.match(visualCss, /\.tools-card\{position:sticky/, 'desktop defense tray must stay visible beside the board');
assert.match(visualCss, /@media\(max-width:980px\)[\s\S]*\.tools-card\{position:static\}/, 'small layouts must disable sticky defense tray behavior');
assert.match(visualCss, /@media\(hover:none\)/, 'touch devices must not inherit hover-only movement');
assert.match(visualCss, /@media\(prefers-reduced-motion:reduce\)/, 'tactical polish must respect reduced-motion preferences');

assert.equal(canonical.lanes.length, 3, 'lane count changed unexpectedly');
assert.equal(canonical.threats.length, 8, 'threat count changed unexpectedly');
assert.equal(canonical.tools.length, 7, 'tool count changed unexpectedly');
assert.equal(new Set(canonical.lanes.map((item) => item.id)).size, 3, 'lane IDs must remain unique');
assert.equal(new Set(canonical.threats.map((item) => item.id)).size, 8, 'threat IDs must remain unique');
assert.equal(new Set(canonical.tools.map((item) => item.id)).size, 7, 'tool IDs must remain unique');

console.log('Grow Room Defense canonical engine runtime, accessibility layer, mobile tool return, and V2 tactical visual-state regression checks passed.');
