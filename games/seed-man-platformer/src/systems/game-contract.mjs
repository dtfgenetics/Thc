import { validateLevelCatalog } from './level-catalog.mjs';

export function validateProductionGameContract({campaign,levels,bosses,enemies,manifest}){
  if (!campaign || typeof campaign !== 'object') throw new Error('Seed Man campaign data is required');
  if (!levels || typeof levels !== 'object') throw new Error('Seed Man level data is required');
  if (Array.isArray(levels.levels)) validateLevelCatalog(levels,{expectedCount:levels.levels.length});
  if (campaign.worlds && !Array.isArray(campaign.worlds)) throw new Error('Campaign worlds must be an array when provided');
  if (bosses != null && typeof bosses !== 'object') throw new Error('Boss data must be an object when provided');
  if (enemies != null && typeof enemies !== 'object') throw new Error('Enemy data must be an object when provided');
  if (manifest != null && typeof manifest !== 'object') throw new Error('Art manifest must be an object when provided');
  return true;
}
