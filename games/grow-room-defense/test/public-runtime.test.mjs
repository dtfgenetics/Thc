import assert from 'node:assert/strict';
import fs from 'node:fs';

const canonical = JSON.parse(fs.readFileSync('games/grow-room-defense/data/ipm.json', 'utf8'));
const html = fs.readFileSync('site/public-route-patch/games/grow-room-defense/index.html', 'utf8');
const app = fs.readFileSync('site/public-route-patch/games/grow-room-defense/app.js', 'utf8');

assert.match(html, /<script\s+id="grow-room-defense-data"\s+type="application\/json">[\s\S]*?<\/script>/i, 'public page must embed IPM game data');
assert.match(html, /<script\s+src="\.\/app\.js"\s+defer><\/script>/i, 'public page must load app.js as a deferred classic script');
assert.doesNotMatch(html, /type="module"/i, 'public page must not depend on ES-module serving');

const embedded = html.match(/<script\s+id="grow-room-defense-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);
assert.ok(embedded, 'embedded defense data block missing');
assert.deepEqual(JSON.parse(embedded[1]), canonical, 'embedded public defense data must exactly match canonical ipm.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public runtime must not depend on browser imports');
assert.doesNotMatch(app, /fetch\(['"]\.\/data\/ipm\.json/i, 'public runtime must not fetch IPM JSON at runtime');
assert.match(app, /function readEmbeddedData\(/, 'runtime must read embedded defense data');
assert.match(app, /function validateData\(/, 'runtime must validate embedded defense data');
assert.match(app, /function createGame\(/, 'runtime must preserve the deterministic game engine');
assert.match(app, /function applyAction\(/, 'runtime must preserve action resolution rules');
assert.match(app, /function renderThreat\(active, laneId, tool, laneAlive\)/, 'threat rendering must know whether the bench is alive');
assert.match(app, /!tool \|\| !laneAlive \|\| state\.status !== 'playing'/, 'dead bench threat buttons must be disabled');
assert.match(app, /const laneAlive = lane\.health > 0/, 'lane render must derive targetability from health');
assert.match(app, /button\.deploy-button\[data-lane\]/, 'bench click delegation must target deploy buttons explicitly');
assert.match(app, /globalThis\.crypto\?\.getRandomValues/, 'random code generation must tolerate missing crypto APIs');
assert.match(app, /function safeReplaceUrl\(/, 'history mutation must be guarded');
assert.match(app, /navigator\.clipboard\?\.writeText/, 'share behavior must tolerate unavailable clipboard APIs');

assert.equal(canonical.lanes.length, 3, 'lane count changed unexpectedly');
assert.equal(canonical.threats.length, 8, 'threat count changed unexpectedly');
assert.equal(canonical.tools.length, 7, 'tool count changed unexpectedly');
assert.equal(new Set(canonical.lanes.map((item) => item.id)).size, 3, 'lane IDs must remain unique');
assert.equal(new Set(canonical.threats.map((item) => item.id)).size, 8, 'threat IDs must remain unique');
assert.equal(new Set(canonical.tools.map((item) => item.id)).size, 7, 'tool IDs must remain unique');

console.log('Grow Room Defense public runtime regression checks passed.');
