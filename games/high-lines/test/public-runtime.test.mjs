import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('site/public-route-patch/games/high-lines/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/high-lines/app.js', 'utf8');
const visual = fs.readFileSync('site/public-route-patch/games/high-lines/high-lines-v2.css', 'utf8');
const canonical = JSON.parse(fs.readFileSync('games/high-lines/data/scenes.json', 'utf8'));

assert.match(html, /<script id="high-lines-data" type="application\/json">/);
assert.match(html, /<script defer src="\.\/app\.js"><\/script>/);
assert.doesNotMatch(html, /type="module"[^>]*app\.js/);
assert.match(html, /high-lines-v2\.css/);
assert.match(html, /id="zoom-out"/);
assert.match(html, /id="zoom-level"/);
assert.match(html, /id="zoom-in"/);
assert.match(html, /id="zoom-reset"/);

const embeddedMatch = html.match(/<script id="high-lines-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(embeddedMatch, 'embedded High Lines data must be present');
assert.deepEqual(JSON.parse(embeddedMatch[1]), canonical, 'public embedded High Lines data must exactly match canonical scenes.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public startup must not depend on browser ES-module imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/scenes\.json/, 'public startup must not fetch scene metadata at runtime');
assert.match(app, /function restoreExperience\(/);
assert.match(app, /function experienceSavePayload\(/);
assert.match(app, /globalThis\.localStorage\?\.setItem/);
assert.match(app, /globalThis\.localStorage\?\.getItem/);
assert.match(app, /globalThis\.localStorage\?\.removeItem/);
assert.match(app, /function fetchSceneText\(/);
assert.match(app, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
assert.match(app, /requestToken !== sceneLoadToken/);
assert.match(app, /svg\.querySelector\('script, foreignObject'\)/);
assert.match(app, /Confirm Reset/);
assert.match(app, /resetTimer = window\.setTimeout\(disarmReset, 4500\)/);
assert.match(app, /const MAX_ZOOM = 2\.5/);
assert.match(app, /svg\.style\.width = `\$\{Math\.round\(zoom \* 100\)\}%`/);
assert.match(app, /globalThis\.crypto\?\.getRandomValues/);
assert.match(app, /globalThis\.history\?\.replaceState/);
assert.match(app, /navigator\.clipboard\?\.writeText/);

assert.match(visual, /\.board-controls/);
assert.match(visual, /overflow:auto/);
assert.match(visual, /touch-action:pan-x pan-y/);
assert.match(visual, /#reset-art\.reset-armed/);
assert.match(visual, /@media\(max-width:650px\)/);
assert.match(visual, /@media\(prefers-reduced-motion:reduce\)/);

console.log('High Lines self-contained startup, persistence and zoom UI regression checks passed.');
