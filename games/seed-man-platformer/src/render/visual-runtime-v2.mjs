import { validateApprovedArtManifest, createApprovedArtRegistry } from './art-registry.mjs';

export const WORLD_KEYS=Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
export const PHENOTYPE_KEYS=Object.freeze(['plant','fire','electric','ice']);
export const CHARACTER_STATES=Object.freeze(['idle','walk','run','jump','fall','land','attack','hit','victory']);

export function createVisualRuntimeV2(manifest,{baseUrl='./'}={}){
  validateApprovedArtManifest(manifest);
  const registry=createApprovedArtRegistry(manifest,{baseUrl});
  for(const key of WORLD_KEYS){
    if(!registry.has(`world.${key}.background`)) throw new Error(`Missing approved world background ${key}`);
  }
  if(!registry.has('character.seedman.atlas')) throw new Error('Missing approved Seed Man atlas');
  if(!registry.has('enemy.atlas')) throw new Error('Missing approved enemy atlas');
  if(!registry.has('boss.atlas')) throw new Error('Missing approved boss atlas');
  if(!registry.has('platform.atlas')) throw new Error('Missing approved platform atlas');
  return Object.freeze({
    version:'seed-man-visual-runtime-v2',
    sourceOfTruth:manifest.sourceOfTruth,
    rendererPolicy:Object.freeze({approvedArtOnly:true,proceduralCharacterFallback:false,legacyAtlasFallback:false}),
    registry,
    player:Object.freeze({atlas:registry.get('character.seedman.atlas'),states:CHARACTER_STATES,phenotypes:PHENOTYPE_KEYS}),
    world:(key)=>{if(!WORLD_KEYS.includes(key)) throw new Error(`Unknown visual world ${key}`);return registry.get(`world.${key}.background`);},
    enemyAtlas:registry.get('enemy.atlas'),
    bossAtlas:registry.get('boss.atlas'),
    platformAtlas:registry.get('platform.atlas'),
    ui:registry.get('ui.vfx.cover'),
    cover:registry.get('cover.main')
  });
}
