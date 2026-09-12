import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/pheno-draft/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/pheno-draft/app.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/pheno-draft/pheno-draft-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/pheno-draft/data/cards.json', 'utf8'));

assert.match(html, /<script id="pheno-draft-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"[^>]*app\.js/);
assert.match(html, /pheno-draft-v2\.css/);
assert.match(html, /id="round-progress-fill"/);
assert.match(html, /id="phase-state"/);

const embeddedMatch = html.match(/<script id="pheno-draft-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded Pheno Draft data must be present');
const embedded = JSON.parse(embeddedMatch[1]);
assert.deepEqual(embedded, canonical, 'public embedded Pheno Draft data must exactly match canonical cards.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser ES-module imports');
assert.doesNotMatch(app, /fetch\s*\(/, 'public runtime must not depend on browser-time JSON fetches');
assert.match(app, /function validateData\(/);
assert.match(app, /function createRun\(/);
assert.match(app, /function projectionSummary\(/);
assert.match(app, /let actionLocked = false/);
assert.match(app, /runHasProgress\(\)/);
assert.match(app, /Confirm New Run/);
assert.match(app, /restartTimer = window\.setTimeout\(disarmRestart, 4500\)/);
assert.match(app, /globalThis\.crypto\?\.getRandomValues/);
assert.match(app, /globalThis\.history\?\.replaceState/);
assert.match(app, /navigator\.clipboard\?\.writeText/);
assert.match(app, /projected-up/);
assert.match(app, /pheno-card improving/);
assert.match(app, /function resetChoiceViewport\(/, 'runtime must reset the horizontal decision rail between decision sets');
assert.match(app, /prefers-reduced-motion: reduce/, 'choice rail reset must honor reduced-motion preference');
assert.match(app, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*ui\.choices\.scrollTo\(\{ left: 0, behavior: reducedMotion \? 'auto' : 'smooth' \}\)/, 'choice rail reset must occur after the new cards render');
assert.match(app, /catch \{[\s\S]*ui\.choices\.scrollLeft = 0/, 'choice rail reset must have a direct-scroll fallback');
const viewportResetCalls = app.match(/resetChoiceViewport\(\);/g) ?? [];
assert.ok(viewportResetCalls.length >= 5, `expected decision-rail reset at load, run reset, phase transitions, and refresh; found ${viewportResetCalls.length}`);
assert.doesNotMatch(app, /scrollIntoView\(/, 'decision-set resets must not vertically move the whole page');

assert.match(visual, /\.round-track/);
assert.match(visual, /\.parent-card\.projected-up/);
assert.match(visual, /\.pheno-card\.declining/);
assert.match(visual, /#new-run\.restart-armed/);
assert.match(visual, /scroll-snap-type:x mandatory/);
assert.match(visual, /@media\(max-width:640px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('Pheno Draft self-contained runtime, comparison UI, and mobile decision-viewport regression checks passed.');
