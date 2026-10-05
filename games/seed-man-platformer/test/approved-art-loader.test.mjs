import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createVisualRuntimeV2, WORLD_KEYS, PHENOTYPE_KEYS } from '../src/render/visual-runtime-v2.mjs';
import { validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json',import.meta.url),'utf8'));
assert.equal(validateApprovedArtManifest(manifest),true);
const runtime=createVisualRuntimeV2(manifest,{baseUrl:'https://dtfseeds.com/games/seed-man-platformer/'});
assert.equal(runtime.version,'seed-man-visual-runtime-v4-transition');
assert.equal(runtime.sourceOfTruth,'classic-seed-man-oval-v1');
assert.equal(runtime.rendererPolicy.approvedArtOnly,true);
assert.equal(runtime.rendererPolicy.proceduralCharacterFallback,false);
assert.equal(runtime.rendererPolicy.legacyAtlasFallback,false);
assert.equal(runtime.rendererPolicy.activeWorldRenderer,'seed-man-authored-flat-background-v1');
assert.equal(runtime.rendererPolicy.worldRendererTarget,'seed-man-three-world-v2');
assert.equal(runtime.rendererPolicy.finalWorldLayerCount,7);
assert.equal(runtime.player.targetCharacter,'classic-seed-man-oval-v1');
assert.equal(runtime.player.states.length,9);
assert.deepEqual(runtime.player.phenotypes,PHENOTYPE_KEYS);

for(const world of WORLD_KEYS){
  const asset=runtime.world(world);
  assert.equal(asset.role,'background');
  assert.equal(asset.renderer,'seed-man-authored-flat-background-v1');
  assert.equal(asset.fallbackRenderer,'seed-man-canvas-world-gradient-v1');
  assert.equal(asset.world,world);
  assert.equal(asset.temporaryFlattened,true);
  assert.match(asset.url,new RegExp(`assets/worlds/${world}-bg-v1\\.png$`));
}
assert.match(runtime.player.atlas.url,/assets\/approved\/seed-man-character-atlas-v2\.webp$/);
assert.match(runtime.enemyAtlas.url,/assets\/approved\/seed-man-enemy-boss-atlas-v1\.webp$/);
assert.match(runtime.bossAtlas.url,/assets\/approved\/seed-man-enemy-boss-atlas-v1\.webp$/);
assert.match(runtime.platformAtlas.url,/assets\/approved\/seed-man-platform-atlas-v1\.webp$/);
assert.equal(runtime.ui.renderer,'seed-man-canvas-vfx-v2');
assert.equal(runtime.cover.renderer,'seed-man-campaign-cover-v1');
console.log('Seed Man standalone approved-art + authored-world transition runtime OK');
