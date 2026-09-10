export function flattenCampaignLevels(campaign) {
  return campaign.worlds.flatMap((world) =>
    world.levels.map((level) => ({ ...level, worldId: world.id, worldTitle: world.title, worldOrder: world.order }))
  );
}

export function validateCampaign(campaign) {
  if (!campaign || campaign.schemaVersion !== 2 || campaign.id !== 'seed-man-campaign-20-v1') {
    throw new Error('campaign contract mismatch');
  }
  if (!Array.isArray(campaign.worlds) || campaign.worlds.length !== 5) {
    throw new Error('campaign must include exactly five worlds');
  }

  const worldIds = new Set();
  const levelIds = new Set();
  const orders = [];
  for (const world of campaign.worlds) {
    if (!world?.id || worldIds.has(world.id) || !Array.isArray(world.levels) || world.levels.length !== 4) {
      throw new Error('invalid campaign world');
    }
    worldIds.add(world.id);

    for (const level of world.levels) {
      if (!level?.id || levelIds.has(level.id)) throw new Error('invalid or duplicate campaign level');
      if (level.status !== 'playable') throw new Error('invalid campaign level status');
      if (!Number.isInteger(level.order) || level.order < 1) throw new Error('invalid campaign level order');
      if (level.dataPath !== 'data/levels-20-v1.json') throw new Error('campaign level must use v20 catalog');
      if (!level.dataKey) throw new Error('campaign level data key is required');
      if ('publicDataElementId' in level) throw new Error('retired embedded-level metadata is forbidden');
      levelIds.add(level.id);
      orders.push(level.order);
    }
  }

  const levels = flattenCampaignLevels(campaign);
  const expectedOrders = Array.from({ length: 20 }, (_, index) => index + 1);
  const actualOrders = [...orders].sort((a, b) => a - b);
  if (levels.length !== 20 || JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) throw new Error('campaign level order must be contiguous 1-20');
  if (campaign.levelCount !== 20 || campaign.levelCount !== levels.length) throw new Error('campaign levelCount does not match v20 manifest');
  if (campaign.newLevelCount !== 19) throw new Error('campaign newLevelCount does not match v20 manifest');
  if (campaign.finalBoss !== 'blight-king') throw new Error('campaign final boss must be blight-king');
  if (!levelIds.has(campaign.defaultLevelId)) throw new Error('campaign default level is missing');
  return campaign;
}

export function createCampaignState(campaign, requestedLevelId = null) {
  const validated = validateCampaign(campaign);
  const levels = flattenCampaignLevels(validated);
  const targetId = requestedLevelId || validated.defaultLevelId;
  const active = levels.find((level) => level.id === targetId);
  if (!active) throw new Error(`unknown campaign level: ${targetId}`);
  if (active.status !== 'playable') throw new Error(`campaign level is not playable: ${targetId}`);

  return Object.freeze({
    campaignId: validated.id,
    activeLevelId: active.id,
    worldId: active.worldId,
    levelOrder: active.order,
    worldOrder: active.worldOrder
  });
}
