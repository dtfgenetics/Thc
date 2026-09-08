import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLevelRuntime } from '../src/systems/level-runtime.mjs';
const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const runtime=createLevelRuntime(read('../data/levels-20-v1.json'),{enemyCatalog:read('../data/enemy-catalog-v1.json'),bossCatalog:read('../data/boss-catalog-v1.json')});
assert.equal(runtime.count,20);
const first=runtime.get('1-1-sprout-steps');assert.equal(first.theme.background,'world.greenhouse-valley.background');assert.equal(first.enemies.length,2);
const final=runtime.get('5-4-the-last-seed');assert.equal(final.boss.finalBoss,true);assert.equal(final.boss.phases,4);
console.log('Seed Man level runtime OK');
