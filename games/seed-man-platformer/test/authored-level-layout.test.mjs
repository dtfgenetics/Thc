import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileAuthoredRecipe, hazardGeometry } from '../src/systems/authored-layout-compiler.mjs';

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

const recipeCatalog = JSON.parse(await readFile(new URL('data/authored-level-recipes-v1.json', root), 'utf8'));
const compile = (id) => {
  const meta=catalog.levels.find((entry)=>entry.id===id);
  assert.ok(meta, `missing level metadata for ${id}`);
  assert.ok(recipeCatalog.levels[id], `missing authored recipe for ${id}`);
  return compileAuthoredRecipe(id,recipeCatalog.levels[id],recipeCatalog.defaults,meta);
};

assert.deepEqual(hazardGeometry('spikes',480),{y:462,height:38},'contact hazards must rise through the walkable surface');
assert.deepEqual(hazardGeometry('waterfall-gap',480),{y:460,height:62},'pit strips must be jumpable collision zones instead of buried decorations');
assert.deepEqual(hazardGeometry('sandstorm',480),{y:0,height:480},'force zones must span the playable vertical space');

const industrial=compile('5-2-industrial-zone');
assert.equal(industrial.revision,4,'authored recipe compiler revision must expose playability geometry v4');
assert.ok(industrial.encounterZones.every((zone)=>Array.isArray(zone.mechanics)&&Array.isArray(zone.hazards)),'encounter zones must preserve mechanic and hazard metadata');
for(const hazard of industrial.hazards.filter((item)=>['laser-grid','crusher'].includes(item.type))){
  assert.ok(hazard.y<480, `${hazard.type} must extend above the ground surface`);
  assert.ok(hazard.y+hazard.height>=480, `${hazard.type} must reach the player standing plane`);
}

const dusty=compile('3-3-dusty-winds');
const sandstorm=dusty.hazards.find((hazard)=>hazard.type==='sandstorm');
assert.ok(sandstorm,'Dusty Winds must compile a sandstorm hazard');
assert.equal(sandstorm.y,0);
assert.equal(sandstorm.y+sandstorm.height,480);

const waterfall=compile('1-3-waterfall-way');
const waterfallGap=waterfall.hazards.find((hazard)=>hazard.type==='waterfall-gap');
assert.ok(waterfallGap,'Waterfall Way must compile a waterfall gap');
assert.ok(waterfallGap.y<480&&waterfallGap.y+waterfallGap.height>480,'waterfall gap must cross the standing collision plane');

assert.match(campaignRuntime, /const hazardGeometry = /, 'public campaign compiler must own the same hazard geometry policy');
assert.match(campaignRuntime, /revision:4/, 'public authored recipe compiler must expose revision 4');

console.log('Seed Man authored production layout and playability geometry contracts passed.');
