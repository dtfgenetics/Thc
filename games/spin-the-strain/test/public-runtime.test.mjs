import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/spin-the-strain/data/wheels.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/spin-the-strain/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/spin-the-strain/app.js', 'utf8');
const css = fs.readFileSync('site/public-route-patch/games/spin-the-strain/spin-the-strain.css', 'utf8');

assert.match(html, /<script\s+id="spin-the-strain-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed wheel data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="spin-the-strain-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded wheel data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public wheel data must exactly match canonical wheels.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/wheels\.json/i, 'public runtime must not fetch wheel JSON at runtime');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function validateData\(/, 'runtime must validate embedded data');
assert.match(app, /function createWheel\(/, 'runtime must include deterministic wheel creation');
assert.match(app, /function spinWheel\(/, 'runtime must include deterministic spin selection');
assert.match(app, /entries\[index\]\.id === state\.lastEntryId/, 'runtime must preserve immediate duplicate prevention');
assert.match(app, /ui\.category\.textContent = 'SPINNING'/, 'result card must hide the selected result during animation');
assert.match(app, /ui\.label\.textContent = 'Wheel in motion'/, 'spinning state must not leak the answer');
assert.match(app, /let spinGeneration = 0;/, 'spin generation must isolate delayed reveal callbacks');
assert.match(app, /function cancelPendingReveal\(/, 'runtime must invalidate prior reveal work before resets and new spins');
assert.match(app, /function finishSpin\(generation\)/, 'finishSpin must identify the spin generation it is resolving');
assert.match(app, /generation !== spinGeneration \|\| !spinning/, 'stale or duplicate reveal callbacks must be ignored');
assert.match(app, /window\.setTimeout\(\(\) => finishSpin\(generation\)/, 'reveal timer must be bound to the current spin generation');
assert.match(app, /if \(!document\.hidden \|\| !spinning\) return;/, 'visibility handler must resolve when the page becomes hidden, not when it returns');
assert.match(app, /finishSpin\(generation\)/, 'hidden-page resolution must use the current generation guard');
assert.match(app, /function compactCategory\(/, 'wheel segments must provide compact mobile labels');
assert.match(app, /label\.dataset\.short = compactCategory/, 'wheel segment elements must expose compact label text to CSS');
assert.match(app, /event\.key === 's' \|\| event\.key === 'S'/, 'S keyboard shortcut must spin outside interactive controls');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(app, /globalThis\.history\?\.replaceState/, 'history mutation must be guarded');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');

assert.match(css, /\.segment-label::after\{content:attr\(data-short\)/, 'mobile wheel must render compact category abbreviations');
assert.match(css, /@media\(max-width:520px\)/, 'mobile wheel layout must be explicitly tuned');
assert.match(css, /\.spin-button\{width:88px/, 'mobile spin target must remain comfortably tappable');
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

assert.equal(canonical.modes.length, 3, 'mode count changed unexpectedly');
assert.equal(canonical.entries.length, 54, 'entry count changed unexpectedly');
for (const mode of canonical.modes) {
  assert.equal(canonical.entries.filter((entry) => entry.mode === mode.id).length, 18, `${mode.id} must retain 18 equal-weight entries`);
}
assert.equal(new Set(canonical.entries.map((entry) => entry.id)).size, canonical.entries.length, 'wheel entry ids must remain unique');

console.log('Spin the Strain public runtime, reveal isolation and mobile wheel regression checks passed.');
