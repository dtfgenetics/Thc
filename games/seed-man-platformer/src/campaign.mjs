export function flattenCampaignLevels(campaign) {
  return campaign.worlds.flatMap((world) =>
    world.levels.map((level) => ({ ...level, worldId: world.id, worldTitle: world.title, worldOrder: world.order }))
  );
}

export function validateCampaign(campaign) {
  if (!campaign || campaign.schemaVersion !== 1 || campaign.id !== 'sprout-run-campaign') {
    throw new Error('campaign contract mismatch');
  }
  if (!Array.isArray(campaign.worlds) || campaign.worlds.length === 0) {
    throw new Error('campaign must include at least one world');
  }

  const worldIds = new Set();
  const levelIds = new Set();
  for (const world of campaign.worlds) {
    if (!world?.id || worldIds.has(world.id) || !Array.isArray(world.levels) || world.levels.length === 0) {
      throw new Error('invalid campaign world');
    }
    worldIds.add(world.id);

    for (const level of world.levels) {
      if (!level?.id || levelIds.has(level.id)) throw new Error('invalid or duplicate campaign level');
      if (!['playable', 'locked', 'preview'].includes(level.status)) throw new Error('invalid campaign level status');
      levelIds.add(level.id);
    }
  }

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
