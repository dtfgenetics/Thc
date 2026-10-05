import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APPROVED_ART_MANIFEST_ID, APPROVED_ART_SOURCE, createApprovedArtRegistry, validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json', import.meta.url), 'utf8'));
assert.equal(validateApprovedArtManifest(manifest), true);
assert.equal(manifest.masterAtlas, undefined, 'retired corrupt master atlas must not return to the canonical manifest');
const registry = createApprovedArtRegistry(manifest, { baseUrl: 'https://dtfseeds.com/games/seed-man-platformer/' });
assert.equal(registry.id, APPROVED_ART_MANIFEST_ID);
assert.equal(registry.sourceOfTruth, APPROVED_ART_SOURCE);
assert.equal(registry.characterTarget, 'classic-seed-man-oval-v1');
assert.equal(registry.worldRenderer, 'seed-man-three-world-v2');
assert.equal(registry.worldRendererTarget, 'seed-man-three-world-v2');
assert.equal(registry.worldFallbackRenderer, 'seed-man-authored-flat-background-v1');
assert.equal(registry.finalWorldLayerCount, 7);
assert.match(registry.characterAtlas().url, /seed-man-character-atlas-v2\.webp$/);
assert.equal(registry.characterAtlas().status, 'temporary-legacy-replacement-pending');
assert.equal(registry.characterAtlas().targetCharacterReference, 'classic-seed-man-oval-v1');
assert.match(registry.enemyAtlas().url, /seed-man-enemy-boss-atlas-v1\.webp$/);
assert.match(registry.bossAtlas().url, /seed-man-enemy-boss-atlas-v1\.webp$/);
assert.match(registry.platformAtlas().url, /seed-man-platform-atlas-v1\.webp$/);
const frozen = registry.worldBackground('frozen-peaks');
assert.equal(frozen.renderer, 'seed-man-authored-flat-background-v1');
assert.equal(frozen.world, 'frozen-peaks');
assert.equal(frozen.temporaryFlattened, true);
assert.match(frozen.url, /assets\/worlds\/frozen-peaks-bg-v1\.png$/);
assert.equal(registry.worldBackground('frozen-peak').world, 'frozen-peaks');
for (const world of ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']) {
  for (const role of ['sky','far-bg','mid-bg','near-bg','gameplay','foreground','vfx']) {
    const layer=registry.get(`world.${world}.${role}`);
    assert.equal(layer.renderer,'seed-man-three-world-v2');
    assert.equal(layer.status,'needed');
  }
}
assert.throws(() => registry.get('character.seedman.legacy'));
console.log('Seed Man repaired art transition registry contract OK');
