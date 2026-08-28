export function calculateMaterialReward({ victory = true, observed = false, highStability = false, overDamaged = false, expressionTag = null }) {
  if (!victory) {
    return {
      materialCount: 0,
      tags: [],
      notes: ['No reward: battle not won.']
    };
  }

  let materialCount = 1;
  const tags = [];
  const notes = ['Base reward earned.'];

  if (observed) {
    notes.push('Observation bonus applied.');
  }

  if (highStability) {
    materialCount += 1;
    notes.push('High Stability bonus: +1 material.');
  }

  if (expressionTag) {
    tags.push(expressionTag);
    notes.push(`Expression tag earned: ${expressionTag}`);
  }

  if (overDamaged) {
    materialCount = Math.max(1, materialCount - 1);
    notes.push('Over-damage penalty applied.');
  }

  return {
    materialCount,
    tags,
    notes
  };
}

export function createBattleRewardRecord({ speciesId, count, tags = [], sourceRegion, expressionId = null }) {
  return {
    speciesId,
    count,
    tags,
    sourceRegion,
    expressionId,
    earnedAt: Date.now()
  };
}
