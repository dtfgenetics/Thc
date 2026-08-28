export function findExpression(expressions, weather, cue) {
  return expressions.find((entry) => entry.weather === weather && entry.cue === cue) ?? null;
}

export function applyStatModifiers(baseStats, expression) {
  if (!expression?.statModifiers) return { ...baseStats };

  const result = { ...baseStats };
  for (const [stat, modifier] of Object.entries(expression.statModifiers)) {
    result[stat] = Math.max(1, (result[stat] ?? 0) + modifier);
  }
  return result;
}

export function getExpressionRewardTag(expression) {
  return expression?.rewardTag ?? 'clear_tag';
}

export function describeExpression(expression) {
  if (!expression) return 'No expression state found.';
  return `${expression.displayName} (${expression.category})`;
}
