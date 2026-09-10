import { validateApprovedArtManifest, createApprovedArtRegistry } from './art-registry.mjs';

export const WORLD_KEYS=Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
export const PHENOTYPE_KEYS=Object.freeze(['plant','fire','electric','ice']);
export const CHARACTER_STATES=Object.freeze(['idle','walk','run','jump','fall','land','attack','hit','victory']);

export function createVisualRuntimeV2(manifest,{baseUrl='./'}={}){
  validateApprovedArtManifest(manifest);
  const registry=createApprovedArtRegistry(manifest,{baseUrl});
  const optional=(key)=>registry.has(key)?registry.get(key):null;
  return Object.freeze({
    version:'seed-man-visual-runtime-open',
    sourceOfTruth:manifest.sourceOfTruth||null,
    rendererPolicy:Object.freeze({
      approvedArtOnly:false,
      proceduralCharacterFallback:true,
      legacyAtlasFallback:true,
      worldRenderer:registry.worldRenderer,
      worldFallbackRenderer:registry.worldFallbackRenderer
    }),
    registry,
    player:Object.freeze({atlas:optional('character.seedman.atlas'),states:CHARACTER_STATES,phenotypes:PHENOTYPE_KEYS}),
    world:(key)=>optional(`world.${key}.background`),
    enemyAtlas:optional('enemy.atlas')||optional('enemy-boss.atlas'),
    bossAtlas:optional('boss.atlas')||optional('enemy-boss.atlas'),
    platformAtlas:optional('platform.atlas'),
    ui:optional('ui.vfx.cover'),
    cover:optional('cover.main')
  });
}
