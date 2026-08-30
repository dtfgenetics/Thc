import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlayer as createCanonicalPlayer, stepPlayer as stepCanonicalPlayer } from '../src/physics.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalLevelText, publicLevelText, html, app, css] = await Promise.all([
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('data/level-01.json', publicRoot), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('app.js', publicRoot), 'utf8'),
  readFile(new URL('seed-man.css', publicRoot), 'utf8')
]);

const canonicalLevel = JSON.parse(canonicalLevelText);
assert.deepStrictEqual(JSON.parse(publicLevelText), canonicalLevel, 'public level JSON must match the canonical level');
assert.equal(canonicalLevel.worldWidth, 7800);
assert.equal(canonicalLevel.pickups.length, 24);
assert.equal(canonicalLevel.checkpoints.length, 3);
assert.ok(canonicalLevel.powerups.length >= 7);

assert.doesNotMatch(html, /<script[^>]+type=["']module["']/i, 'public runtime must not depend on module-script MIME handling');
assert.match(html, /<script\s+src=["']\.\/app\.js\?v=[^"']+["']\s+defer><\/script>/i, 'public runtime should use a versioned deferred classic script');
assert.match(html, /JUMP ×2/, 'touch UI must advertise the double-jump control');
assert.match(html, /id=["']power-count["']/, 'HUD must expose active power-up state');
assert.match(html, /id=["']jump-count["']/, 'HUD must expose double-jump readiness');

const levelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(levelMatch, 'public page must embed the canonical level data');
assert.deepStrictEqual(JSON.parse(levelMatch[1]), canonicalLevel, 'embedded public level must match canonical level-01.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public app.js must be self-contained');
assert.doesNotMatch(app, /fetch\s*\(/i, 'public app.js must not fetch runtime data');
assert.match(app, /doubleJumpSpeed:\s*590/, 'public runtime must contain the stronger double jump');
assert.match(app, /maxAirJumps:\s*1/, 'public runtime must preserve one mid-air jump');
assert.match(app, /function\s+collectPowerup\s*\(/, 'public runtime must include power-up collection');
assert.match(app, /function\s+guardedReset\s*\(/, 'active runs should guard destructive restart');
assert.match(app, /function\s+drawPowerup\s*\(/, 'power-ups must be visible in the canvas renderer');
assert.match(app, /function\s+drawProgressRail\s*\(/, 'expanded level needs visible course progress');
assert.match(app, /function\s+readEmbeddedLevel\s*\(/, 'public runtime should read embedded level data');
assert.match(app, /function\s+writeBest\s*\(/, 'public runtime should guard best-time persistence');
assert.match(app, /function\s+focusCanvas\s*\(/, 'public runtime should guard canvas focus');
assert.match(css, /position:sticky/, 'mobile touch controls should remain reachable during the longer run');
assert.match(css, /min-height:72px/, 'mobile touch targets should remain large enough for repeated double-jump input');

const runtimeEnd = app.indexOf("const BEST_KEY = 'dtf-seed-man-best-v1';");
assert.ok(runtimeEnd > 0, 'could not isolate inlined public physics runtime');
const runtimeSource = app.slice(0, runtimeEnd);
const sandbox = {
  console,
  JSON,
  Number,
  Array,
  Math,
  Object
};
vm.createContext(sandbox);
vm.runInContext(runtimeSource, sandbox, { filename: 'public-seed-man-physics.js' });

assert.equal(typeof sandbox.createPlayer, 'function');
assert.equal(typeof sandbox.stepPlayer, 'function');

let canonicalPlayer = createCanonicalPlayer(canonicalLevel.spawn);
let publicPlayer = sandbox.createPlayer(canonicalLevel.spawn);
assert.deepStrictEqual(JSON.parse(JSON.stringify(publicPlayer)), canonicalPlayer, 'public createPlayer must match canonical runtime');

for (let frame = 0; frame < 480; frame += 1) {
  const input = {
    left: false,
    right: frame < 450,
    jumpPressed: frame === 38 || frame === 52 || frame === 126 || frame === 141 || frame === 270 || frame === 286
  };
  canonicalPlayer = stepCanonicalPlayer(canonicalPlayer, input, canonicalLevel, 1 / 60);
  publicPlayer = sandbox.stepPlayer(publicPlayer, input, canonicalLevel, 1 / 60);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(publicPlayer)),
    canonicalPlayer,
    `public physics diverged from canonical physics at frame ${frame}`
  );
}

console.log('Seed Man expanded public runtime regression checks passed.');