import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApprovedArtRegistry, validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json', import.meta.url), 'utf8'));
assert.equal(validateApprovedArtManifest(manifest), true);
const registry = createApprovedArtRegistry(manifest, { baseUrl: 'https://dtfseeds.com/games/seed-man-platformer/' });
assert.equal(registry.id, 'seed-man-approved-art-v1');
assert.equal(registry.has('character.seedman.atlas'), true);
assert.match(registry.characterAtlas().url, /seed-man-character-atlas-approved-v1\.webp$/);
assert.match(registry.worldBackground('frozen-peaks').url, /world-frozen-approved-v1\.webp$/);
assert.throws(() => registry.get('character.seedman.legacy'));
console.log('Seed Man approved art registry contract OK');
