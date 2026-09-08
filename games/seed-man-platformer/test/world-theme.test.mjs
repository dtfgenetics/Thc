import assert from 'node:assert/strict';
import { WORLD_THEMES,getWorldTheme } from '../src/systems/world-theme.mjs';
assert.deepEqual(Object.keys(WORLD_THEMES),['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
for(const [key,theme] of Object.entries(WORLD_THEMES)){
  assert.ok(theme.background.startsWith(`world.${key}.background`));
  assert.ok(theme.terrain.length>=3);
  assert.ok(theme.hazards.length>=2);
  assert.equal(getWorldTheme(key),theme);
}
console.log('Seed Man world themes OK');
