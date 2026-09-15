import { validateApprovedArtManifest, createApprovedArtRegistry } from './art-registry.mjs';

export const WORLD_KEYS=Object.freeze(['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']);
export const PHENOTYPE_KEYS=Object.freeze(['plant','fire','electric','ice']);
export const CHARACTER_STATES=Object.freeze(['idle','walk','run','jump','fall','land','attack','hit','victory']);

export function createVisualRuntimeV2(manifest,{baseUrl='./'}={}){
  validateApprovedArtManifest(manifest);
  const registry=createApprovedArtRegistry(manifest,{baseUrl});
  for(const key of WORLD_KEYS){
    const world=registry.get(`world.${key}.background`);
    if(world.renderer!==registry.worldFallbackRenderer) throw new Error(`Missing authored transition world renderer ${key}`);
    if(!world.url||!world.url.endsWith('.png')||world.temporaryFlattened!==true) throw new Error(`Missing authored transition world master ${key}`);
    for(const role of ['sky','far-bg','mid-bg','near-bg','gameplay','foreground','vfx']){
      const layer=registry.get(`world.${key}.${role}`);
      if(layer.renderer!==registry.worldRendererTarget||layer.status!=='needed') throw new Error(`Missing final world layer target ${key}.${role}`);
    }
  }
  if(!registry.has('character.seedman.atlas')) throw new Error('Missing approved Seed Man atlas');
  if(!registry.has('enemy.atlas')) throw new Error('Missing approved enemy atlas');
  if(!registry.has('boss.atlas')) throw new Error('Missing approved boss atlas');
  if(!registry.has('platform.atlas')) throw new Error('Missing approved platform atlas');
  return Object.freeze({
    version:'seed-man-visual-runtime-v4-transition',
    sourceOfTruth:manifest.sourceOfTruth,
    rendererPolicy:Object.freeze({
      approvedArtOnly:true,
      proceduralCharacterFallback:false,
      legacyAtlasFallback:false,
      activeWorldRenderer:registry.worldFallbackRenderer,
      worldRendererTarget:registry.worldRendererTarget,
      finalWorldLayerCount:registry.finalWorldLayerCount
    }),
    registry,
    player:Object.freeze({atlas:registry.get('character.seedman.atlas'),states:CHARACTER_STATES,phenotypes:PHENOTYPE_KEYS,targetCharacter:'classic-seed-man-oval-v1'}),
    world:(key)=>{if(!WORLD_KEYS.includes(key)) throw new Error(`Unknown visual world ${key}`);return registry.get(`world.${key}.background`);},
    enemyAtlas:registry.get('enemy.atlas'),
    bossAtlas:registry.get('boss.atlas'),
    platformAtlas:registry.get('platform.atlas'),
    ui:registry.get('ui.vfx.cover'),
    cover:registry.get('cover.main')
  });
}
