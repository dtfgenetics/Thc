import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateLevelCatalog, buildLevelIndex, getWorldLevels, getNextLevel, getBossLevels } from '../src/systems/level-catalog.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/levels-20-v1.json',import.meta.url),'utf8'));
validateLevelCatalog(catalog);
const index=buildLevelIndex(catalog);
assert.equal(index.size,20);
assert.equal(getWorldLevels(catalog,'greenhouse-valley').length,4);
assert.equal(getWorldLevels(catalog,'forest-ruins').length,4);
assert.equal(getWorldLevels(catalog,'desert-canyon').length,4);
assert.equal(getWorldLevels(catalog,'frozen-peaks').length,4);
assert.equal(getWorldLevels(catalog,'eco-city').length,4);
assert.equal(getBossLevels(catalog).length,6);
assert.equal(getNextLevel(catalog,'1-1-sprout-steps').id,'1-2-sunny-glade');
assert.equal(getNextLevel(catalog,'5-4-the-last-seed'),null);
console.log('Seed Man level catalog OK');
