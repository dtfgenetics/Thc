import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createVisualRuntimeV2, WORLD_KEYS, PHENOTYPE_KEYS } from '../src/render/visual-runtime-v2.mjs';
import { validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json',import.meta.url),'utf8'));
assert.equal(validateApprovedArtManifest(manifest),true);
const runtime=createVisualRuntimeV2(manifest,{baseUrl:'https://dtfseeds.com/games/seed-man-platformer/'});
assert.equal(runtime.version,'seed-man-visual-runtime-v2');
assert.equal(runtime.rendererPolicy.approvedArtOnly,true);
assert.equal(runtime.rendererPolicy.proceduralCharacterFallback,false);
assert.equal(runtime.rendererPolicy.legacyAtlasFallback,false);
assert.equal(runtime.player.states.length,9);
assert.deepEqual(runtime.player.phenotypes,PHENOTYPE_KEYS);
for(const world of WORLD_KEYS){
  assert.match(runtime.world(world).url,/assets\/approved\/seed-man-approved-master-atlas-v1\.webp$/);
  assert.deepEqual(runtime.world(world).region,manifest.masterAtlas.regions['world.atlas']);
}
assert.match(runtime.player.atlas.url,/seed-man-approved-master-atlas-v1\.webp$/);
assert.deepEqual(runtime.player.atlas.region,manifest.masterAtlas.regions['character.seedman.atlas']);
assert.deepEqual(runtime.enemyAtlas.region,manifest.masterAtlas.regions['enemy-boss.atlas']);
assert.deepEqual(runtime.bossAtlas.region,manifest.masterAtlas.regions['enemy-boss.atlas']);
assert.deepEqual(runtime.platformAtlas.region,manifest.masterAtlas.regions['platform.atlas']);
assert.deepEqual(runtime.ui.region,manifest.masterAtlas.regions['ui-vfx.atlas']);
console.log('Seed Man approved-art-only visual runtime v2 OK');
