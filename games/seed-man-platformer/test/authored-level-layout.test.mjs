import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalText, publicText, campaignRuntime, enemyRuntime] = await Promise.all([
  readFile(new URL('data/levels-20-v1.json', root), 'utf8'),
  readFile(new URL('data/levels-20-v1.json', publicRoot), 'utf8'),
  readFile(new URL('campaign-v20-runtime.js', publicRoot), 'utf8'),
  readFile(new URL('v20-enemy-runtime.js', publicRoot), 'utf8')
]);

assert.equal(publicText, canonicalText, 'public level catalog must stay byte-for-byte aligned with canonical data');
const catalog = JSON.parse(canonicalText);
const level = catalog.levels.find((entry) => entry.id === '1-1-sprout-steps');
assert.ok(level, 'Sprout Steps must exist');
assert.equal(level.layout?.mode, 'authored', 'Sprout Steps must use an authored layout');
assert.equal(level.layout?.revision, 1);
assert.equal(level.length, 6200);
assert.equal(level.layout.requiredPickups, 18);
assert.equal(level.layout.pickups.length, 18);
assert.equal(level.layout.checkpoints.length, 2);
assert.equal(level.layout.enemySpawns.length, 6);
assert.deepEqual([...new Set(level.layout.enemySpawns.map((spawn) => spawn.type))].sort(), ['root-crawler','sproutling']);
assert.deepEqual(level.layout.phenotypeCarrierSpawns.map((spawn) => spawn.form), ['fire']);
assert.equal(level.layout.finish.x, 6060);
assert.ok(level.mechanics.includes('authored-layout'));
assert.ok(level.mechanics.includes('combat-intro'));
assert.ok(level.mechanics.includes('phenotype-intro'));

const allObjects = [
  ...level.layout.platforms,
  ...level.layout.hazards,
  ...level.layout.pickups,
  ...level.layout.checkpoints,
  ...level.layout.enemySpawns,
  ...level.layout.phenotypeCarrierSpawns
];
const ids = allObjects.map((item) => item.id).filter(Boolean);
assert.equal(new Set(ids).size, ids.length, 'authored layout object IDs must be unique');
for (const item of allObjects) {
  if (Number.isFinite(item.x)) assert.ok(item.x >= 0 && item.x <= level.length, `${item.id} x must be inside level bounds`);
}
for (const checkpoint of level.layout.checkpoints) {
  assert.ok(checkpoint.respawnX >= 0 && checkpoint.respawnX < level.length, `${checkpoint.id} respawn must be inside level bounds`);
  assert.ok(checkpoint.respawnX < checkpoint.x, `${checkpoint.id} respawn should be before the checkpoint`);
}
for (const spawn of [...level.layout.enemySpawns, ...level.layout.phenotypeCarrierSpawns]) {
  assert.ok(spawn.minX <= spawn.x, `${spawn.id} patrol min must include spawn`);
  assert.ok(spawn.maxX > spawn.x, `${spawn.id} patrol max must extend past spawn`);
}

assert.match(campaignRuntime, /seed-man-authored-levels-v1/, 'campaign runtime must expose authored-level contract');
assert.match(campaignRuntime, /function generateAuthoredLevel\(/, 'campaign runtime must build authored levels directly');
assert.match(campaignRuntime, /authoringMode:'authored'/, 'authored runtime state marker missing');
assert.match(campaignRuntime, /authoringMode:'generated'/, 'generated fallback marker missing for unfinished levels');
assert.match(campaignRuntime, /authoredLevelCount/, 'campaign runtime must report authored-level migration progress');
assert.match(enemyRuntime, /function buildAuthoredEnemies\(/, 'enemy runtime must honor authored placements');
assert.match(enemyRuntime, /phenotypeCarrierSpawns/, 'enemy runtime must honor authored phenotype carrier placements');
assert.match(enemyRuntime, /authoredPlacement:Boolean\(options\.authored\)/, 'enemy runtime must expose authored placement state');

console.log('Sprout Steps authored production layout contract passed.');
