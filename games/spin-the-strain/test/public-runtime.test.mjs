import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/spin-the-strain/data/wheels.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/spin-the-strain/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/spin-the-strain/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/spin-the-strain/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/spin-the-strain/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/spin-the-strain/src/engine.mjs', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/spin-the-strain/spin-the-strain.css', 'utf8');

assert.match(html, /<script\s+id="spin-the-strain-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed wheel data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="spin-the-strain-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded wheel data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public wheel data must exactly match canonical wheels.json');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical Spin the Strain engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\(['"]\.\/data\/wheels\.json/i, 'runtime must not fetch wheel JSON at runtime');
assert.match(runtime, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(runtime, /function validateData\(/, 'runtime must validate embedded data');
for (const forbidden of ['function createWheel(', 'function spinWheel(', 'function entriesForMode(', 'function normalizeWheelCode(', 'function isValidWheelCode(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /All 18 entries appear once before this mode starts a new cycle\./, 'ready state must disclose the no-repeat cycle rule');
assert.match(runtime, /Cycle \$\{result\.cycleNumber\}, \$\{result\.cyclePosition\} of \$\{result\.cycleSize\}/, 'ARIA result announcement must include cycle progress');
assert.match(runtime, /ui\.category\.textContent = 'SPINNING'/, 'result card must hide the selected result during animation');
assert.match(runtime, /ui\.label\.textContent = 'Wheel in motion'/, 'spinning state must not leak the answer');
assert.match(runtime, /let spinGeneration = 0;/, 'spin generation must isolate delayed reveal callbacks');
assert.match(runtime, /function cancelPendingReveal\(/, 'runtime must invalidate prior reveal work before resets and new spins');
assert.match(runtime, /function finishSpin\(generation\)/, 'finishSpin must identify the spin generation it is resolving');
assert.match(runtime, /generation !== spinGeneration \|\| !spinning/, 'stale or duplicate reveal callbacks must be ignored');
assert.match(runtime, /window\.setTimeout\(\(\) => finishSpin\(generation\)/, 'reveal timer must be bound to the current spin generation');
assert.match(runtime, /if \(!document\.hidden \|\| !spinning\) return;/, 'visibility handler must resolve when the page becomes hidden, not when it returns');
assert.match(runtime, /finishSpin\(generation\)/, 'hidden-page resolution must use the current generation guard');
assert.match(runtime, /function compactCategory\(/, 'wheel segments must provide compact mobile labels');
assert.match(runtime, /label\.dataset\.short = compactCategory/, 'wheel segment elements must expose compact label text to CSS');
assert.match(runtime, /event\.key === 's' \|\| event\.key === 'S'/, 'S keyboard shortcut must spin outside interactive controls');
assert.match(runtime, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(runtime, /globalThis\.history\?\.replaceState/, 'history mutation must be guarded');
assert.match(runtime, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(runtime, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share wheel/, 'share failure must preserve the full manual challenge path');

assert.match(css, /\.segment-label::after\{content:attr\(data-short\)/, 'mobile wheel must render compact category abbreviations');
assert.match(css, /\.wheel-stage\[aria-busy="true"\] \.wheel/, 'wheel must expose a stronger visual spinning state');
assert.match(css, /\.wheel-stage\[aria-busy="true"\] \.pointer/, 'pointer must react visibly while the wheel is spinning');
assert.match(css, /@keyframes pointer-tick/, 'spinning pointer feedback must use a dedicated keyframe');
assert.match(css, /\.result-card\.revealed/, 'result reveal must have a dedicated visual state');
assert.match(css, /\.history-list li:first-child:not\(\.empty-state\)/, 'latest spin history entry must be visually prioritized');
assert.match(css, /\.control-card\{position:sticky/, 'desktop challenge controls must stay available without covering the wheel');
assert.match(css, /@media\(max-width:520px\)/, 'mobile wheel layout must be explicitly tuned');
assert.match(css, /\.spin-button\{width:92px;min-width:92px\}/, 'mobile spin target must remain comfortably tappable');
assert.match(css, /@media\(hover:none\)/, 'touch devices must not inherit hover-only movement');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/, 'spin polish must respect reduced-motion preferences');
assert.match(css, /@media\(forced-colors:active\)/, 'wheel controls and states must remain visible in forced-colors mode');
assert.match(css, /outline:3px solid Highlight/, 'forced-colors focus must remain visible');

assert.equal(canonical.modes.length, 3, 'mode count changed unexpectedly');
assert.equal(canonical.entries.length, 54, 'entry count changed unexpectedly');
for (const mode of canonical.modes) {
  assert.equal(canonical.entries.filter((entry) => entry.mode === mode.id).length, 18, `${mode.id} must retain 18 cycle entries`);
}
assert.equal(new Set(canonical.entries.map((entry) => entry.id)).size, canonical.entries.length, 'wheel entry ids must remain unique');

console.log('Spin the Strain canonical engine runtime, no-repeat cycle, visual spin states, reveal isolation and mobile wheel regression checks passed.');
