export function normalizePair(parentA, parentB) {
  return [parentA, parentB].sort().join('|');
}

export function ruleMatchesPair(rule, parentA, parentB) {
  return normalizePair(rule.parentA, rule.parentB) === normalizePair(parentA, parentB);
}

export function findPairingRule(rules, parentA, parentB) {
  return rules.find((rule) => ruleMatchesPair(rule, parentA, parentB)) ?? null;
}

export function canUsePairingRule(rule, playerState) {
  if (!rule) return false;

  const unlockedRegions = playerState.unlockedRegions ?? [];
  const rankOrder = ['seedling_runner', 'field_scout', 'pheno_hunter', 'vault_runner', 'garden_keeper', 'legacy_keeper'];
  const currentRankIndex = rankOrder.indexOf(playerState.rank);
  const requiredRankIndex = rankOrder.indexOf(rule.requiredRank);

  const rankAllowed = currentRankIndex >= requiredRankIndex;
  const regionAllowed = unlockedRegions.includes(rule.requiredRegion);

  return rankAllowed && regionAllowed;
}

export function previewPairing({ rules, parentA, parentB, playerState }) {
  const rule = findPairingRule(rules, parentA, parentB);

  if (!rule) {
    return {
      allowed: false,
      reason: 'no_pairing_rule',
      ruleId: null,
      resultPool: [],
      chanceWeights: {},
      markerBias: {}
    };
  }

  const allowed = canUsePairingRule(rule, playerState);
  return {
    allowed,
    reason: allowed ? 'allowed' : 'locked_by_rank_or_region',
    ruleId: rule.id,
    requiredRank: rule.requiredRank,
    requiredRegion: rule.requiredRegion,
    resultPool: rule.resultPool,
    chanceWeights: rule.chanceWeights,
    markerBias: rule.markerBias
  };
}

export function pickPairingQuality(chanceWeights, random = Math.random) {
  const entries = Object.entries(chanceWeights ?? {});
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return 'stable';

  let roll = random() * total;
  for (const [quality, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return quality;
  }

  return entries.at(-1)?.[0] ?? 'stable';
}
