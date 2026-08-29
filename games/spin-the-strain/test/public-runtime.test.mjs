import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/spin-the-strain/data/wheels.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/spin-the-strain/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/spin-the-strain/app.js', 'utf8');

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
assert.match(app, /function finishSpin\(/, 'runtime must reveal the result only through finishSpin');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(app, /function safeReplaceUrl\(/, 'history mutation must be guarded');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');

assert.equal(canonical.modes.length, 3, 'mode count changed unexpectedly');
assert.equal(canonical.entries.length, 54, 'entry count changed unexpectedly');
for (const mode of canonical.modes) {
  assert.equal(canonical.entries.filter((entry) => entry.mode === mode.id).length, 18, `${mode.id} must retain 18 equal-weight entries`);
}
assert.equal(new Set(canonical.entries.map((entry) => entry.id)).size, canonical.entries.length, 'wheel entry ids must remain unique');

console.log('Spin the Strain public runtime regression checks passed.');
