import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApprovedArtRegistry, validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json', import.meta.url), 'utf8'));
assert.equal(validateApprovedArtManifest(manifest), true);
assert.equal(manifest.policy?.authoritative, false);
assert.equal(manifest.policy?.styleLocked, false);
assert.equal(manifest.policy?.rendererLocked, false);

const registry = createApprovedArtRegistry(manifest, { baseUrl: 'https://dtfseeds.com/games/seed-man-platformer/' });
assert.equal(registry.id, 'seed-man-art-registry');
assert.deepEqual(registry.keys(), []);
assert.equal(registry.characterAtlas(), null);
assert.equal(registry.enemyAtlas(), null);
assert.equal(registry.bossAtlas(), null);
assert.equal(registry.platformAtlas(), null);
assert.equal(registry.worldBackground('frozen-peaks'), null);
assert.throws(() => registry.get('missing.asset'), /Unknown Seed Man asset key/);

const flexible = structuredClone(manifest);
flexible.assets['character.seedman.idle'] = { src: 'assets/new/seed-man-idle.webp', type: 'image' };
assert.equal(validateApprovedArtManifest(flexible), true);
const flexibleRegistry = createApprovedArtRegistry(flexible, { baseUrl: 'https://example.test/game/' });
assert.match(flexibleRegistry.get('character.seedman.idle').url, /assets\/new\/seed-man-idle\.webp$/);

console.log('Seed Man open art registry contract OK');
