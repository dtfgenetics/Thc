import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlayer as createCanonicalPlayer, stepPlayer as stepCanonicalPlayer } from '../src/physics.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalLevelText, html, app] = await Promise.all([
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('app.js', publicRoot), 'utf8')
]);

const canonicalLevel = JSON.parse(canonicalLevelText);

assert.doesNotMatch(html, /<script[^>]+type=["']module["']/i, 'public runtime must not depend on module-script MIME handling');
assert.match(html, /<script\s+src=["']\.\/app\.js["']\s+defer><\/script>/i, 'public runtime should use one deferred classic script');

const levelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(levelMatch, 'public page must embed the canonical level data');
assert.deepStrictEqual(JSON.parse(levelMatch[1]), canonicalLevel, 'embedded public level must match canonical level-01.json');

assert.doesNotMatch(app, /^\s*import\s/m, 'public app.js must be self-contained');
assert.doesNotMatch(app, /fetch\s*\(\s*['"]\.\/data\/level-01\.json/i, 'public app.js must not fetch level JSON at runtime');
assert.match(app, /function\s+readEmbeddedLevel\s*\(/, 'public runtime should read embedded level data');
assert.match(app, /function\s+writeBest\s*\(/, 'public runtime should guard best-time persistence');
assert.match(app, /function\s+focusCanvas\s*\(/, 'public runtime should guard canvas focus');

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

for (let frame = 0; frame < 240; frame += 1) {
  const input = {
    left: false,
    right: frame < 220,
    jumpPressed: frame === 38 || frame === 98 || frame === 158
  };
  canonicalPlayer = stepCanonicalPlayer(canonicalPlayer, input, canonicalLevel, 1 / 60);
  publicPlayer = sandbox.stepPlayer(publicPlayer, input, canonicalLevel, 1 / 60);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(publicPlayer)),
    canonicalPlayer,
    `public physics diverged from canonical physics at frame ${frame}`
  );
}

console.log('Seed Man public runtime regression checks passed.');
