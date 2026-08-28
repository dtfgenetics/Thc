export function canStartRecipe(entry) {
  return entry.materialsOwned >= entry.materialsRequired;
}

export function spendMaterials(entry, amount) {
  return {
    ...entry,
    materialsOwned: Math.max(0, entry.materialsOwned - amount)
  };
}

export function chooseTrait(traits = [], random = Math.random) {
  if (!traits.length) return null;
  const index = Math.floor(random() * traits.length);
  return traits[index];
}

export function rollQuality(stability = 50, random = Math.random) {
  const roll = random() * 100 + stability * 0.25;

  if (roll >= 105) return 'legacy_touched';
  if (roll >= 90) return 'keeper_candidate';
  if (roll >= 70) return 'strong';
  if (roll >= 35) return 'stable';
  return 'weak';
}

export function createResultUnit({ species, expression, sourceTags = [], random = Math.random }) {
  const stability = Math.max(1, species.baseStats.stability + (expression?.statModifiers?.stability ?? 0));
  const trait = chooseTrait(species.traits, random);
  const quality = rollQuality(stability, random);

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
    isKeeper: quality === 'keeper_candidate' || quality === 'legacy_touched',
    createdAt: Date.now()
  };
}
