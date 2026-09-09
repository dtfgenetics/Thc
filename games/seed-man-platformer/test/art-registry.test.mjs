import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APPROVED_ART_MANIFEST_ID, APPROVED_ART_SOURCE, createApprovedArtRegistry, validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json', import.meta.url), 'utf8'));
assert.equal(validateApprovedArtManifest(manifest), true);
const registry = createApprovedArtRegistry(manifest, { baseUrl: 'https://dtfseeds.com/games/seed-man-platformer/' });
assert.equal(registry.id, APPROVED_ART_MANIFEST_ID);
assert.equal(registry.sourceOfTruth, APPROVED_ART_SOURCE);
assert.equal(registry.has('character.seedman.atlas'), true);
assert.match(registry.characterAtlas().url, /seed-man-approved-master-atlas-v1\.webp$/);
assert.deepEqual(registry.characterAtlas().region, manifest.masterAtlas.regions['character.seedman.atlas']);
assert.match(registry.worldBackground('frozen-peaks').url, /seed-man-approved-master-atlas-v1\.webp$/);
assert.equal(registry.worldBackground('frozen-peaks').region.width, 320);
assert.equal(registry.worldBackground('eco-city').region.x, 1280);
assert.throws(() => registry.get('character.seedman.legacy'));
console.log('Seed Man approved art registry v2 contract OK');
