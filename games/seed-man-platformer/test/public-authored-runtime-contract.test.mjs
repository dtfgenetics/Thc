import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const publicRoot=path.join(repo,'site/public-route-patch/games/seed-man-platformer');
const runtime=fs.readFileSync(path.join(publicRoot,'campaign-v20-runtime.js'),'utf8');
const levels=JSON.parse(fs.readFileSync(path.join(publicRoot,'data/levels-20-v1.json'),'utf8'));
const recipes=JSON.parse(fs.readFileSync(path.join(publicRoot,'data/authored-level-recipes-v1.json'),'utf8'));
const worlds=JSON.parse(fs.readFileSync(path.join(publicRoot,'data/world-gameplay-v1.json'),'utf8'));
const powerups=JSON.parse(fs.readFileSync(path.join(publicRoot,'data/powerup-catalog-v1.json'),'utf8'));

assert.equal(levels.levels.length,20,'public catalog must contain 20 levels');
assert.equal(Object.keys(recipes.levels||{}).length,19,'public recipe catalog must author levels 1-2 through 5-4');
assert.equal(levels.levels.filter((level)=>level.layout?.mode==='authored').length,1,'Level 1-1 remains the explicit authored layout');
assert.equal(1+Object.keys(recipes.levels||{}).length,20,'explicit layout plus authored recipes must cover all 20 levels');
assert.equal(Object.keys(worlds.worlds||{}).length,5,'public world gameplay contract must expose five worlds');
assert.deepEqual(Object.keys(powerups.forms||{}).sort(),['electric','fire','ice','plant']);

for(const marker of [
  'authored-level-recipes-v1.json',
  'world-gameplay-v1.json',
  'powerup-catalog-v1.json',
  'function compileAuthoredRecipe(',
  "mode:'authored'",
  "authoringMode:'authored'",
  'generatedLevelCount',
  'authoredLevelCount',
  'seedManAuthoredLevels',
  'seedManGeneratedLevels'
]) assert.ok(runtime.includes(marker),`public campaign runtime missing authored-system marker: ${marker}`);

for(const level of levels.levels){
  if(level.layout?.mode==='authored') continue;
  assert.ok(recipes.levels[level.id],`public runtime recipe missing for ${level.id}`);
  assert.equal(recipes.levels[level.id].world,level.world,`${level.id} recipe world must match level catalog`);
  assert.ok(recipes.levels[level.id].sections.length>=5,`${level.id} requires authored pacing sections`);
}

for(const world of Object.values(worlds.worlds)){
  assert.equal(world.layers.length,7,`${world.title} must define seven visual layers`);
  assert.equal(Object.keys(world.layerAssetKeys||{}).length,7,`${world.title} must map seven visual layer keys`);
}

console.log(JSON.stringify({ok:true,levels:20,explicitAuthored:1,authoredRecipes:19,worlds:5,powerForms:4},null,2));
