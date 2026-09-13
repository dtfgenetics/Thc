import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuthoredLayoutIndex } from '../src/systems/authored-layout-compiler.mjs';
import { HAZARD_DEFS, hazardIsActive, resolveHazardContact } from '../src/systems/hazard-system.mjs';
import { createPowerupState, collectPhenotypePickup, updatePowerupState, createDropFromDefeatedEnemy } from '../src/systems/powerup-system-v2.mjs';
import { createWorldVisualSystem, REQUIRED_LAYERS } from '../src/systems/world-visual-system.mjs';
import { createLevelRuntime } from '../src/systems/level-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const data=(name)=>JSON.parse(fs.readFileSync(path.resolve(here,'../data',name),'utf8'));
const recipes=data('authored-level-recipes-v1.json');
const levels=data('levels-20-v1.json');
const enemies=data('enemy-catalog-v1.json');
const bosses=data('boss-catalog-v1.json');
const worlds=data('world-gameplay-v1.json');
const manifest=data('seed-man-art-manifest-v1.json');

const authored=buildAuthoredLayoutIndex(recipes);
assert.equal(authored.size,19,'all remaining campaign levels must have authored recipes');
for(const [id,layout] of authored){
  assert.equal(layout.mode,'authored-recipe',`${id} must compile as authored`);
  assert.ok(layout.platforms.length>=5,`${id} needs playable ground/platform geometry`);
  assert.ok(layout.pickups.length>=5,`${id} needs collectibles`);
  assert.ok(layout.encounterZones.length>=5,`${id} needs authored encounter pacing`);
  assert.ok(layout.finish.x>layout.spawn.x,`${id} finish must be after spawn`);
}

const runtime=createLevelRuntime(levels,{enemyCatalog:enemies,bossCatalog:bosses,recipeCatalog:recipes});
assert.equal(runtime.count,20);
assert.equal(runtime.authoredIds().length,20,'campaign should resolve all 20 levels through explicit or recipe-authored layout');
assert.equal(runtime.get('1-2-sunny-glade').authored,true);
assert.equal(runtime.get('5-4-the-last-seed').layout.bosses[0].type,'blight-king');

assert.ok(Object.keys(HAZARD_DEFS).length>=19,'all campaign hazard classes should be represented');
assert.equal(hazardIsActive('laser-grid',0),true);
assert.equal(hazardIsActive('laser-grid',1000),false);
assert.equal(resolveHazardContact('lava').damage,2);
assert.equal(resolveHazardContact('waterfall-gap').respawn,true);

let power=createPowerupState();
power=collectPhenotypePickup(power,'fire',1000,'test');
assert.equal(power.active,'fire');
assert.ok(power.expiresAt>1000);
power=updatePowerupState(power,40000);
assert.equal(power.active,'plant','temporary phenotype must expire back to plant');
const drop=createDropFromDefeatedEnemy({id:'carrier-1',phenotype:'electric',x:20,y:30},500);
assert.equal(drop.phenotype,'electric');
assert.equal(drop.type,'phenotype');

const visuals=createWorldVisualSystem(worlds,manifest);
assert.equal(visuals.ids().length,5);
for(const worldId of visuals.ids()){
  const world=visuals.get(worldId);
  assert.equal(world.layers.length,REQUIRED_LAYERS.length,`${worldId} must expose full parallax layer contract`);
  assert.ok(world.layers.every((layer)=>layer.key&&layer.asset),`${worldId} layer keys must exist in the art manifest`);
}

console.log(JSON.stringify({ok:true,authoredLevels:runtime.authoredIds().length,worlds:visuals.ids().length,hazards:Object.keys(HAZARD_DEFS).length},null,2));
