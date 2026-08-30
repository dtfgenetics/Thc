'use strict';

const SPROUT_CAMPAIGN_RUNTIME_VERSION = 'sprout-campaign-v1';

function readEmbeddedCampaign() {
  const node = document.querySelector('#seed-man-campaign');
  if (!node) throw new Error('embedded campaign data missing');
  return JSON.parse(node.textContent || '');
}

function flattenCampaignLevels(campaign) {
  return campaign.worlds.flatMap((world) =>
    world.levels.map((level) => ({ ...level, worldId: world.id, worldTitle: world.title, worldOrder: world.order }))
  );
}

function validateCampaign(campaign) {
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

function createCampaignRuntime(campaign) {
  const manifest = validateCampaign(campaign);
  const levels = flattenCampaignLevels(manifest);
  let activeLevelId = manifest.defaultLevelId;

  function getLevel(levelId = activeLevelId) {
    return levels.find((level) => level.id === levelId) || null;
  }

  function selectLevel(levelId) {
    const level = getLevel(levelId);
    if (!level) throw new Error(`unknown campaign level: ${levelId}`);
    if (level.status !== 'playable') throw new Error(`campaign level is not playable: ${levelId}`);
    activeLevelId = level.id;
    window.dispatchEvent(new CustomEvent('sprout:level-selected', { detail: { levelId: activeLevelId } }));
    return level;
  }

  const defaultLevel = getLevel(manifest.defaultLevelId);
  const embeddedLevelNode = document.querySelector(`#${defaultLevel?.publicDataElementId || ''}`);
  if (!embeddedLevelNode) throw new Error('campaign default level payload missing');
  const embeddedLevel = JSON.parse(embeddedLevelNode.textContent || '');
  if (embeddedLevel.id !== manifest.defaultLevelId) throw new Error('campaign default level does not match embedded gameplay level');

  return Object.freeze({
    version: SPROUT_CAMPAIGN_RUNTIME_VERSION,
    campaignId: manifest.id,
    defaultLevelId: manifest.defaultLevelId,
    get activeLevelId() { return activeLevelId; },
    worlds: Object.freeze(manifest.worlds.map((world) => Object.freeze({ ...world }))),
    listLevels() { return levels.map((level) => ({ ...level })); },
    getLevel,
    selectLevel
  });
}

try {
  window.__SPROUT_CAMPAIGN__ = createCampaignRuntime(readEmbeddedCampaign());
  document.documentElement.dataset.sproutCampaign = window.__SPROUT_CAMPAIGN__.campaignId;
} catch (error) {
  console.error('Sprout Run campaign foundation failed to initialize.', error);
}
