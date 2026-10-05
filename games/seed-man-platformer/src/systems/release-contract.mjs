export const SEED_MAN_RELEASE_CONTRACT=Object.freeze({
  version:'seed-man-release-contract-v3',
  campaignLevels:20,
  worlds:['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'],
  phenotypes:['plant','fire','electric','ice'],
  finalBoss:'blight-king',
  characterTarget:'classic-seed-man-oval-v1',
  currentCharacterStatus:'temporary-green-armored-replacement-pending',
  activeWorldRenderer:'seed-man-authored-flat-background-v1',
  worldRendererTarget:'seed-man-three-world-v2',
  finalWorldLayerCount:7,
  approvedArtOnly:true,
  proceduralCharacterFallback:false,
  legacyAtlasFallback:false
});

export function validateReleaseContract({campaign,manifest}){
  if(campaign?.levelCount!==SEED_MAN_RELEASE_CONTRACT.campaignLevels) throw new Error('Release must contain 20 Seed Man levels');
  if(campaign?.worlds?.length!==SEED_MAN_RELEASE_CONTRACT.worlds.length) throw new Error('Release must contain five Seed Man worlds');
  if(campaign?.finalBoss!==SEED_MAN_RELEASE_CONTRACT.finalBoss) throw new Error('Release final boss mismatch');
  if(manifest?.policy?.authoritative!==true) throw new Error('Seed Man art manifest must be authoritative');
  if(manifest?.policy?.proceduralFallbackAllowed!==false) throw new Error('Procedural character fallback must be disabled');
  if(manifest?.policy?.legacyAtlasFallbackAllowed!==false) throw new Error('Legacy atlas fallback must be disabled');
  if(manifest?.policy?.characterReference!==SEED_MAN_RELEASE_CONTRACT.characterTarget) throw new Error('Classic Seed Man character target mismatch');
  if(manifest?.policy?.currentCharacterAtlasStatus!==SEED_MAN_RELEASE_CONTRACT.currentCharacterStatus) throw new Error('Current Seed Man character transition status mismatch');
  if(manifest?.policy?.worldFallbackRenderer!==SEED_MAN_RELEASE_CONTRACT.activeWorldRenderer) throw new Error('Active Seed Man world renderer mismatch');
  if(manifest?.policy?.worldRendererTarget!==SEED_MAN_RELEASE_CONTRACT.worldRendererTarget) throw new Error('Seed Man final world renderer target mismatch');
  if(manifest?.policy?.finalWorldLayerCount!==SEED_MAN_RELEASE_CONTRACT.finalWorldLayerCount) throw new Error('Seed Man final world layer target mismatch');
  return true;
}
