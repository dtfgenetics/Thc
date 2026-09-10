import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createVisualRuntimeV2, PHENOTYPE_KEYS } from '../src/render/visual-runtime-v2.mjs';
import { validateApprovedArtManifest } from '../src/render/art-registry.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('../data/seed-man-art-manifest-v1.json',import.meta.url),'utf8'));
assert.equal(validateApprovedArtManifest(manifest),true);
const runtime=createVisualRuntimeV2(manifest,{baseUrl:'https://dtfseeds.com/games/seed-man-platformer/'});
assert.equal(runtime.version,'seed-man-visual-runtime-open');
assert.equal(runtime.rendererPolicy.approvedArtOnly,false);
assert.equal(runtime.rendererPolicy.proceduralCharacterFallback,true);
assert.equal(runtime.rendererPolicy.legacyAtlasFallback,true);
assert.equal(runtime.player.states.length,9);
assert.deepEqual(runtime.player.phenotypes,PHENOTYPE_KEYS);
assert.equal(runtime.player.atlas,null);
assert.equal(runtime.enemyAtlas,null);
assert.equal(runtime.bossAtlas,null);
assert.equal(runtime.platformAtlas,null);
assert.equal(runtime.ui,null);
assert.equal(runtime.cover,null);

const replacement=structuredClone(manifest);
replacement.assets['character.seedman.atlas']={src:'assets/redesign/seed-man.webp',type:'atlas',role:'player'};
const replacementRuntime=createVisualRuntimeV2(replacement,{baseUrl:'https://dtfseeds.com/games/seed-man-platformer/'});
assert.match(replacementRuntime.player.atlas.url,/assets\/redesign\/seed-man\.webp$/);

console.log('Seed Man open visual runtime OK');
