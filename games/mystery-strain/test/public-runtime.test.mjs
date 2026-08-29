import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/mystery-strain/data/strains.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/mystery-strain/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/mystery-strain/app.js', 'utf8');

assert.match(html, /<script\s+id="mystery-strain-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed deduction data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="mystery-strain-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded deduction data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public data must exactly match canonical strains.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/strains\.json/i, 'public runtime must not fetch strain JSON at runtime');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded data');
assert.match(app, /function validateData\(/, 'runtime must validate embedded data before play');
assert.match(app, /function createGame\(/, 'runtime must include the deterministic game engine');
assert.match(app, /function rankedQuestionOptions\(/, 'runtime must include information-ranked questions');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random case generation must tolerate missing crypto APIs');
assert.match(app, /function safeReplaceUrl\(/, 'history mutation must be guarded');
assert.match(app, /function safeFocus\(/, 'focus-with-options must have a compatibility fallback');
assert.match(app, /function prefersReducedMotion\(/, 'reduced-motion lookup must be guarded');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');

assert.equal(canonical.questions.length, 12, 'canonical deduction question count changed unexpectedly');
assert.equal(canonical.strains.length, 20, 'canonical fictional profile count changed unexpectedly');
assert.equal(new Set(canonical.questions.map((item) => item.id)).size, 12, 'question ids must be unique');
assert.equal(new Set(canonical.strains.map((item) => item.id)).size, 20, 'profile ids must be unique');

console.log('Mystery Strain public runtime regression checks passed.');
