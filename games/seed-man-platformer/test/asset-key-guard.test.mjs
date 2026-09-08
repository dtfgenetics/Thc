import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertManifestAssetKey, validateLevelAssetKeys } from '../src/systems/asset-key-guard.mjs';

const levels=JSON.parse(fs.readFileSync(new URL('../data/levels-20-v1.json',import.meta.url),'utf8'));
for(const level of levels.levels) assert.equal(validateLevelAssetKeys(level),true);
assert.equal(assertManifestAssetKey('character.seedman.atlas'),'character.seedman.atlas');
assert.throws(()=>assertManifestAssetKey('assets/seedman.png'));
assert.throws(()=>assertManifestAssetKey('seedman.webp'));
console.log('Seed Man manifest key guard OK');
