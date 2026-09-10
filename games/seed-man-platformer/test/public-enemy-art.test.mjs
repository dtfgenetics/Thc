import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);
const [enemyRuntimeSource, combatSource] = await Promise.all([
  readFile(new URL('v20-enemy-runtime.js', publicRoot), 'utf8'),
  readFile(new URL('combat-browser-v2.js', publicRoot), 'utf8')
]);

const sandbox = { window:{} };
vm.createContext(sandbox);
vm.runInContext(enemyRuntimeSource, sandbox, { filename:'v20-enemy-runtime.js' });
const runtime = sandbox.window.__SEED_MAN_V20_ENEMY_RUNTIME__;
assert.ok(runtime, 'public v20 enemy runtime must install');
assert.equal(runtime.version, 'seed-man-v20-enemy-runtime-v2');
assert.equal(runtime.atlasLayout.width, 320);
assert.equal(runtime.atlasLayout.height, 120);
assert.equal(runtime.atlasLayout.enemy.columns, 6, 'approved enemy row has six cells');
assert.equal(runtime.atlasLayout.boss.columns, 4, 'approved boss row has four cells');

const bosses = [
  ['overgrown-guardian', 3, false],
  ['ancient-dryad', 3, false],
  ['scorchroot-titan', 3, false],
  ['frostbite-colossus', 3, false],
  ['eco-sentinel', 3, false],
  ['blight-king', 4, true]
];
for (const [id, phases, finalBoss] of bosses) {
  const boss = runtime.buildBoss({
    id:`test-${id}`,
    worldWidth:6400,
    boss:{id,name:id,requiredHits:finalBoss?16:8,phases,phase:1,finalBoss,x:5200,y:320,arenaStartX:4700,arenaEndX:6100}
  });
  assert.ok(boss, `boss runtime missing ${id}`);
  assert.equal(boss.approvedVisual.row, 'boss');
  assert.ok(boss.approvedVisual.frame >= 0 && boss.approvedVisual.frame < 4, `${id} uses off-atlas boss frame`);
  const region = boss.approvedVisual.region;
  assert.ok(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0, `${id} region must be positive`);
  assert.ok(region.x + region.width <= 1.000001, `${id} region exceeds atlas width`);
  assert.ok(region.y + region.height <= 1.000001, `${id} region exceeds atlas height`);
  assert.equal(region.y, 0.5, `${id} must use boss row`);
  assert.equal(region.width, 0.25, `${id} must use one of four boss cells`);
  assert.equal(region.height, 0.5, `${id} boss row height mismatch`);
}

const finaleEncounter = runtime.buildEncounter({
  id:'5-4-the-last-seed',
  levelNumber:20,
  difficulty:20,
  worldWidth:7600,
  enemyPool:['shadow-root','drone-bot','sludge-monster'],
  mechanics:['final-gauntlet'],
  boss:{id:'blight-king',name:'The Blight King',requiredHits:16,phases:4,phase:1,finalBoss:true,x:6400,y:300,arenaStartX:5600,arenaEndX:7300}
});
const finaleCarrierForms = finaleEncounter.filter((enemy)=>enemy.phenotype).map((enemy)=>enemy.phenotype).sort();
assert.deepStrictEqual(finaleCarrierForms, ['electric','fire','ice'], 'Level 20 must provide all three temporary phenotype carriers');

assert.match(combatSource, /const BLIGHT_WEAKNESSES = Object\.freeze\(\['plant','fire','electric','ice'\]\)/, 'browser combat must use canonical final-boss weakness cycle');
assert.match(combatSource, /phenotype===blightWeakness\(enemy\)\?1\.5:0\.65/, 'browser combat must use canonical weakness/resistance multipliers');
assert.match(combatSource, /const phenotype=ability\?\(activePhenotype\|\|def\.form\|\|'plant'\):'plant'/, 'browser projectiles must carry phenotype identity');
assert.match(combatSource, /const BOSS_FRAME_COLS = 4/, 'browser renderer must know approved boss row has four cells');
assert.match(combatSource, /function sourceRect\(visual\)/, 'browser renderer must crop from explicit approved atlas regions');
assert.doesNotMatch(combatSource, /naturalWidth\/ENEMY_FRAME_COLS[\s\S]{0,160}visual\.row==='boss'/, 'boss renderer must not slice boss row using enemy column count');

console.log('Seed Man public enemy/boss atlas geometry, finale carriers, and Blight King weakness contract passed');
