import { validateApprovedArtManifest } from '../render/art-registry.mjs';

export function validateProductionGameContract({campaign,levels,bosses,enemies,manifest}){
  if (!campaign || typeof campaign !== 'object') throw new Error('Seed Man campaign data is missing');
  if (!levels || typeof levels !== 'object') throw new Error('Seed Man level data is missing');
  if (campaign.worlds != null && !Array.isArray(campaign.worlds)) throw new Error('Seed Man campaign worlds must be an array when provided');
  if (levels.levels != null && !Array.isArray(levels.levels)) throw new Error('Seed Man levels must be an array when provided');
  if (bosses != null && typeof bosses !== 'object') throw new Error('Seed Man boss data must be an object when provided');
  if (enemies != null && typeof enemies !== 'object') throw new Error('Seed Man enemy data must be an object when provided');
  if (manifest) validateApprovedArtManifest(manifest);
  return true;
}
