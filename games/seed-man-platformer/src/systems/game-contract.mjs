import { validateLevelCatalog } from './level-catalog.mjs';
import { PHENOTYPES } from './phenotype-system.mjs';

export function validateProductionGameContract({campaign,levels,bosses,enemies,manifest}){
  if(campaign?.levelCount!==20) throw new Error('Seed Man production contract requires 20 levels');
  if(campaign?.worlds?.length!==5) throw new Error('Seed Man production contract requires 5 worlds');
  validateLevelCatalog(levels,{expectedCount:20});
  if(campaign.worlds.flatMap(world=>world.levels).length!==20) throw new Error('Campaign/world level count mismatch');
  if(campaign.finalBoss!=='blight-king') throw new Error('Final boss must be Blight King');
  const finalBoss=bosses?.bosses?.['blight-king'];
  if(!finalBoss?.finalBoss||finalBoss.phases!==4) throw new Error('Blight King must be a 4-phase final boss');
  if(!enemies?.phenotypeCarriers) throw new Error('Phenotype carriers are required');
  for(const id of ['fire','electric','ice']){
    if(PHENOTYPES[id].durationMs!==30000) throw new Error(`${id} phenotype must last 30 seconds`);
  }
  if(manifest?.id!=='seed-man-approved-art-v2'||manifest?.policy?.authoritative!==true) throw new Error('Approved Seed Man art manifest v2 must own production');
  if(manifest.policy.proceduralFallbackAllowed!==false||manifest.policy.legacyAtlasFallbackAllowed!==false) throw new Error('Production visual fallbacks are forbidden');
  return true;
}
