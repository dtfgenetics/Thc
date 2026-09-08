export const SEED_MAN_RELEASE_CONTRACT=Object.freeze({
  version:'seed-man-release-contract-v2',
  campaignLevels:20,
  worlds:['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'],
  phenotypes:['plant','fire','electric','ice'],
  finalBoss:'blight-king',
  approvedArtOnly:true,
  proceduralCharacterFallback:false,
  legacyAtlasFallback:false
});

export function validateReleaseContract({campaign,manifest}){
  if(campaign?.levelCount!==SEED_MAN_RELEASE_CONTRACT.campaignLevels) throw new Error('Release must contain 20 Seed Man levels');
  if(campaign?.finalBoss!==SEED_MAN_RELEASE_CONTRACT.finalBoss) throw new Error('Release final boss mismatch');
  if(manifest?.policy?.authoritative!==true) throw new Error('Approved art manifest must be authoritative');
  if(manifest?.policy?.proceduralFallbackAllowed!==false) throw new Error('Procedural visual fallback must be disabled');
  if(manifest?.policy?.legacyAtlasFallbackAllowed!==false) throw new Error('Legacy atlas fallback must be disabled');
  return true;
}
