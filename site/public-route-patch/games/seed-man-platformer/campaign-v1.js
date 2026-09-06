'use strict';

const SPROUT_CAMPAIGN_RUNTIME_VERSION = 'sprout-campaign-v2';
const SPROUT_CAMPAIGN_MANIFEST = Object.freeze({
  schemaVersion: 2,
  id: 'sprout-run-campaign',
  title: 'Seed Man: Sprout Run',
  defaultLevelId: 'sprout-run',
  levelCount: 11,
  newLevelCount: 10,
  worlds: [
    { id: 'world-01', title: 'Greenhouse District', order: 1, levels: [
      { id: 'sprout-run', title: 'Greenhouse Gauntlet', order: 1, status: 'playable', dataPath: 'data/level-01.json', publicDataElementId: 'seed-man-level' },
      { id: 'nursery-night-shift', title: 'Nursery Night Shift', order: 2, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'nursery-night-shift', publicDataElementId: 'seed-man-level' },
      { id: 'reservoir-run', title: 'Reservoir Run', order: 3, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'reservoir-run', publicDataElementId: 'seed-man-level' }
    ]},
    { id: 'world-02', title: 'Rootworks', order: 2, levels: [
      { id: 'root-zone-rumble', title: 'Root Zone Rumble', order: 4, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'root-zone-rumble', publicDataElementId: 'seed-man-level' },
      { id: 'mycelium-mile', title: 'Mycelium Mile', order: 5, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'mycelium-mile', publicDataElementId: 'seed-man-level' },
      { id: 'trichome-transit', title: 'Trichome Transit', order: 6, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'trichome-transit', publicDataElementId: 'seed-man-level' }
    ]},
    { id: 'world-03', title: 'Resin Works', order: 3, levels: [
      { id: 'kief-cavern-climb', title: 'Kief Cavern Climb', order: 7, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'kief-cavern-climb', publicDataElementId: 'seed-man-level' },
      { id: 'rosin-refinery-rush', title: 'Rosin Refinery Rush', order: 8, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'rosin-refinery-rush', publicDataElementId: 'seed-man-level' },
      { id: 'terpene-tunnel', title: 'Terpene Tunnel', order: 9, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'terpene-tunnel', publicDataElementId: 'seed-man-level' }
    ]},
    { id: 'world-04', title: 'Sky Garden', order: 4, levels: [
      { id: 'frostline-canopy', title: 'Frostline Canopy', order: 10, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'frostline-canopy', publicDataElementId: 'seed-man-level' },
      { id: 'cloud-nine-citadel', title: 'Cloud Nine Citadel', order: 11, status: 'playable', dataPath: 'data/levels-02-11.json', dataKey: 'cloud-nine-citadel', publicDataElementId: 'seed-man-level' }
    ]}
  ]
});

function flattenCampaignLevels(campaign) {
  return campaign.worlds.flatMap((world) => world.levels.map((level) => ({ ...level, worldId: world.id, worldTitle: world.title, worldOrder: world.order })));
}

function validateCampaign(campaign) {
  if (!campaign || campaign.schemaVersion !== 2 || campaign.id !== 'sprout-run-campaign') throw new Error('campaign contract mismatch');
  if (!Array.isArray(campaign.worlds) || campaign.worlds.length !== 4) throw new Error('campaign must include four worlds');
  const levels = flattenCampaignLevels(campaign);
  if (levels.length !== 11 || campaign.levelCount !== 11 || campaign.newLevelCount !== 10) throw new Error('campaign must include eleven levels with ten new stages');
  const ids = new Set();
  for (const level of levels) {
    if (!level.id || ids.has(level.id) || level.status !== 'playable') throw new Error('invalid or duplicate campaign level');
    ids.add(level.id);
  }
  if (!ids.has(campaign.defaultLevelId)) throw new Error('campaign default level is missing');
  return campaign;
}

function createCampaignRuntime(campaign) {
  const manifest = validateCampaign(campaign);
  const levels = flattenCampaignLevels(manifest);
  let activeLevelId = manifest.defaultLevelId;
  function getLevel(levelId = activeLevelId) { return levels.find((entry) => entry.id === levelId) || null; }
  function selectLevel(levelId) {
    const selected = getLevel(levelId);
    if (!selected) throw new Error(`unknown campaign level: ${levelId}`);
    if (selected.status !== 'playable') throw new Error(`campaign level is not playable: ${levelId}`);
    activeLevelId = selected.id;
    window.dispatchEvent(new CustomEvent('sprout:level-selected', { detail: { levelId: activeLevelId, level: { ...selected } } }));
    return { ...selected };
  }
  return Object.freeze({
    version: SPROUT_CAMPAIGN_RUNTIME_VERSION,
    campaignId: manifest.id,
    defaultLevelId: manifest.defaultLevelId,
    levelCount: levels.length,
    newLevelCount: manifest.newLevelCount,
    get activeLevelId() { return activeLevelId; },
    worlds: Object.freeze(manifest.worlds.map((world) => Object.freeze({ ...world, levels: Object.freeze(world.levels.map((entry) => Object.freeze({ ...entry }))) }))),
    listLevels() { return levels.map((entry) => ({ ...entry })); },
    getLevel,
    selectLevel
  });
}

try {
  const manifestNode = document.querySelector('#seed-man-campaign');
  if (manifestNode) manifestNode.textContent = JSON.stringify(SPROUT_CAMPAIGN_MANIFEST);
  window.__SPROUT_CAMPAIGN__ = createCampaignRuntime(SPROUT_CAMPAIGN_MANIFEST);
  document.documentElement.dataset.sproutCampaign = SPROUT_CAMPAIGN_MANIFEST.id;
  document.documentElement.dataset.sproutCampaignLevels = '11';

  for (const src of ['./campaign-expansion-v2.js?v=20260906-campaign11', './seed-man-animation-v2.js?v=20260906-motion2']) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.append(script);
  }
} catch (error) {
  console.error('Sprout Run campaign failed to initialize.', error);
}
