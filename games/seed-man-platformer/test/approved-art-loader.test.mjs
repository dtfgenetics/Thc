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

const expectedAtlas=/assets\/approved\/seed-man-approved-master-atlas-v1\.webp$/;
const worldRegions=[];
for(const world of WORLD_KEYS){
  const asset=runtime.world(world);
  assert.match(asset.url,expectedAtlas);
  assert.equal(asset.role,'background');
  assert.ok(asset.region?.width>0&&asset.region?.height>0,`missing approved region for ${world}`);
  worldRegions.push(`${asset.region.x}:${asset.region.y}:${asset.region.width}:${asset.region.height}`);
}
assert.equal(new Set(worldRegions).size,WORLD_KEYS.length,'each approved world must occupy a distinct master-atlas region');
assert.match(runtime.player.atlas.url,expectedAtlas);
assert.match(runtime.enemyAtlas.url,expectedAtlas);
assert.match(runtime.bossAtlas.url,expectedAtlas);
assert.match(runtime.platformAtlas.url,expectedAtlas);
assert.match(runtime.ui.url,expectedAtlas);
assert.match(runtime.cover.url,expectedAtlas);
console.log('Seed Man approved-art-only master-atlas visual runtime OK');
