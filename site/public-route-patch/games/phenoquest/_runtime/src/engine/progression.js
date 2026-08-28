export const RANK_ORDER = [
  'seedling_runner',
  'field_scout',
  'pheno_hunter',
  'vault_runner',
  'garden_keeper',
  'legacy_keeper'
];

export function getRankIndex(rank) {
  const index = RANK_ORDER.indexOf(rank);
  return index === -1 ? 0 : index;
}

export function isRankAtLeast(currentRank, requiredRank) {
  return getRankIndex(currentRank) >= getRankIndex(requiredRank);
}

export function hasRegionUnlocked(saveData, regionId) {
  return (saveData.world?.unlockedRegions ?? []).includes(regionId);
}

export function getProgressionState(saveData) {
  return {
    rank: saveData.player?.rank ?? 'seedling_runner',
    unlockedRegions: saveData.world?.unlockedRegions ?? [],
    flags: saveData.quests?.flags ?? {}
  };
}

export function canAccessSystem(saveData, systemId) {
  const flags = saveData.quests?.flags ?? {};

  if (systemId === 'lineage_preview') {
    return flags.lineage_preview_unlocked === true;
  }

  if (systemId === 'terp_fields') {
    return hasRegionUnlocked(saveData, 'terp_fields') || flags.terp_fields_access === true;
  }

  return false;
}
