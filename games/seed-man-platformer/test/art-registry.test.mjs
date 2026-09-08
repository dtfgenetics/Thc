import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApprovedArtRegistry, validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json', import.meta.url), 'utf8'));
assert.equal(validateApprovedArtManifest(manifest), true);
const registry = createApprovedArtRegistry(manifest, { baseUrl: 'https://dtfseeds.com/games/seed-man-platformer/' });
assert.equal(registry.id, 'seed-man-approved-art-v2');
assert.equal(registry.has('character.seedman.atlas'), true);
assert.match(registry.characterAtlas().url, /seed-man-approved-master-atlas-v1\.webp$/);
assert.deepEqual(registry.characterAtlas().region, manifest.masterAtlas.regions['character.seedman.atlas']);
assert.match(registry.worldBackground('frozen-peaks').url, /seed-man-approved-master-atlas-v1\.webp$/);
assert.equal(registry.worldBackground('frozen-peaks').worldKey, 'frozen-peak');
assert.deepEqual(registry.worldBackground('frozen-peaks').region, manifest.masterAtlas.regions['world.atlas']);
assert.equal(registry.has('ui.vfx.cover'), true);
assert.throws(() => registry.get('character.seedman.legacy'));
console.log('Seed Man approved art registry v2 contract OK');
