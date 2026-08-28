export function createTimerResult({ species, expression = null, sourceTags = [] }) {
  const stabilityBonus = expression?.statModifiers?.stability ?? 0;
  const stability = Math.max(1, species.baseStats.stability + stabilityBonus);
  const trait = species.traits?.[0] ?? null;
  const quality = stability >= 8 ? 'strong' : 'stable';

  return {
    uniqueId: `${species.id}_${Date.now()}`,
    speciesId: species.id,
    displayName: species.displayName,
    level: 1,
    trait,
    expression: expression?.id ?? null,
    sourceTags,
    stability,
    quality,
    isKeeper: quality === 'strong',
    createdAt: Date.now()
  };
}
