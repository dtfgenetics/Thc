export function getStarterOptions(units) {
  const starterIds = new Set(['mango_puff', 'kush_cub', 'frostling']);
  return units.filter((unit) => starterIds.has(unit.id));
}

export function createStarterUnit(species) {
  return {
    uniqueId: `${species.id}_starter`,
    speciesId: species.id,
    displayName: species.displayName,
    level: 1,
    trait: species.traits?.[0] ?? null,
    expression: null,
    sourceTags: ['starter'],
    stability: species.baseStats.stability,
    quality: 'starter',
    isKeeper: false,
    createdAt: Date.now()
  };
}

export function chooseStarter(units, starterId) {
  const species = units.find((unit) => unit.id === starterId);
  if (!species) {
    throw new Error(`Starter not found: ${starterId}`);
  }
  return createStarterUnit(species);
}
