import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/pheno-draft/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/pheno-draft/app.js', 'utf8');
const runtime = fs.readFileSync('site/public-route-patch/games/pheno-draft/runtime.mjs', 'utf8');
const publicEngine = fs.readFileSync('site/public-route-patch/games/pheno-draft/engine.mjs', 'utf8');
const canonicalEngine = fs.readFileSync('games/pheno-draft/src/engine.mjs', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/pheno-draft/pheno-draft-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/pheno-draft/data/cards.json', 'utf8'));

assert.match(html, /<script id="pheno-draft-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.match(html, /pheno-draft-v2\.css/);
assert.match(html, /id="round-progress-fill"/);
assert.match(html, /id="phase-state"/);

const embeddedMatch = html.match(/<script id="pheno-draft-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded Pheno Draft data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded Pheno Draft data must exactly match canonical cards.json');

assert.equal(publicEngine, canonicalEngine, 'public engine.mjs must exactly match the canonical Pheno Draft engine');
assert.match(app, /import\('\.\/runtime\.mjs'\)/, 'app.js must delegate to runtime.mjs');
assert.ok(app.length < 1500, 'app.js must remain a thin compatibility bootstrap');
assert.match(runtime, /from '\.\/engine\.mjs';/, 'runtime must import the canonical public engine');
assert.doesNotMatch(runtime, /fetch\s*\(/, 'runtime must not depend on browser-time JSON fetches');
assert.match(runtime, /function validateData\(/);
for (const forbidden of ['function createRun(', 'function refreshDraft(', 'function selectParent(', 'function selectPhenotype(', 'function generatePhenotypes(', 'function hash(', 'function clone(']) {
  assert.equal(runtime.includes(forbidden), false, `runtime must not duplicate canonical rules: ${forbidden}`);
}
assert.match(runtime, /function projectionSummary\(/);
assert.match(runtime, /let actionLocked = false/);
assert.match(runtime, /runHasProgress\(\)/);
assert.match(runtime, /Confirm New Run/);
assert.match(runtime, /restartTimer = window\.setTimeout\(disarmRestart, 4500\)/);
assert.match(runtime, /globalThis\.crypto\?\.getRandomValues/);
assert.match(runtime, /globalThis\.history\?\.replaceState/);
assert.match(runtime, /navigator\.clipboard\?\.writeText/);
assert.match(runtime, /async function copyText\(/, 'share behavior must expose a clipboard fallback helper');
assert.match(runtime, /document\.execCommand\?\.\('copy'\) === true/, 'share behavior must retain a legacy clipboard fallback');
assert.match(runtime, /Copy failed\. Share run code/, 'share failure must preserve the full manual challenge path');
assert.match(runtime, /projected-up/);
assert.match(runtime, /pheno-card improving/);
assert.match(runtime, /function resetChoiceViewport\(/, 'runtime must reset the horizontal decision rail between decision sets');
assert.match(runtime, /prefers-reduced-motion: reduce/, 'choice rail reset must honor reduced-motion preference');
assert.match(runtime, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*ui\.choices\.scrollTo\(\{ left: 0, behavior: reducedMotion \? 'auto' : 'smooth' \}\)/, 'choice rail reset must occur after the new cards render');
assert.match(runtime, /catch \{[\s\S]*ui\.choices\.scrollLeft = 0/, 'choice rail reset must have a direct-scroll fallback');
const viewportResetCalls = runtime.match(/resetChoiceViewport\(\);/g) ?? [];
assert.ok(viewportResetCalls.length >= 5, `expected decision-rail reset at load, run reset, phase transitions, and refresh; found ${viewportResetCalls.length}`);
assert.doesNotMatch(runtime, /scrollIntoView\(/, 'decision-set resets must not vertically move the whole page');

assert.match(visual, /\.round-track/);
assert.match(visual, /\.parent-card\.projected-up/);
assert.match(visual, /\.pheno-card\.declining/);
assert.match(visual, /#new-run\.restart-armed/);
assert.match(visual, /scroll-snap-type:x mandatory/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);
const baseCss = fs.readFileSync('site/public-route-patch/games/pheno-draft/pheno-draft.css', 'utf8');
assert.match(baseCss, /@media\(forced-colors:active\)/, 'draft controls must remain visible in forced-colors mode');
assert.match(baseCss, /outline:3px solid Highlight/, 'forced-colors focus must remain visible');

console.log('Pheno Draft canonical engine runtime, comparison UI, and mobile decision-viewport regression checks passed.');
