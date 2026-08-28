export function createCollectionEntry(speciesId, materialsRequired = 1) {
  return {
    speciesId,
    seen: false,
    battled: false,
    materialsOwned: 0,
    materialsRequired,
    recipeUnlocked: false,
    rootedCount: 0,
    knownTraits: [],
    knownExpressions: [],
    keeperFound: false,
    vaultProgress: 0
  };
}

export function getOrCreateEntry(collection, speciesId, materialsRequired = 1) {
  return collection[speciesId] ?? createCollectionEntry(speciesId, materialsRequired);
}

export function markSeen(collection, species) {
  const entry = getOrCreateEntry(collection, species.id, species.recipe?.materialsRequired ?? 1);
  return {
    ...collection,
    [species.id]: {
      ...entry,
      seen: true,
      vaultProgress: Math.max(entry.vaultProgress, 5)
    }
  };
}

export function addBattleProgress(collection, species) {
  const entry = getOrCreateEntry(collection, species.id, species.recipe?.materialsRequired ?? 1);
  return {
    ...collection,
    [species.id]: {
      ...entry,
      seen: true,
      battled: true,
      vaultProgress: Math.max(entry.vaultProgress, 15)
    }
  };
}

export function addMaterials(collection, species, amount, expressionId = null) {
  const entry = getOrCreateEntry(collection, species.id, species.recipe?.materialsRequired ?? 1);
  const knownExpressions = expressionId && !entry.knownExpressions.includes(expressionId)
    ? [...entry.knownExpressions, expressionId]
    : entry.knownExpressions;

  const materialsOwned = entry.materialsOwned + amount;

  return {
    ...collection,
    [species.id]: {
      ...entry,
      seen: true,
      battled: true,
      materialsOwned,
      recipeUnlocked: materialsOwned >= entry.materialsRequired,
      knownExpressions,
      vaultProgress: Math.max(entry.vaultProgress, materialsOwned >= entry.materialsRequired ? 30 : 20)
    }
  };
}

export function spendMaterials(collection, speciesId, amount) {
  const entry = getOrCreateEntry(collection, speciesId, amount);
  const materialsOwned = Math.max(0, entry.materialsOwned - amount);

  return {
    ...collection,
    [speciesId]: {
      ...entry,
      materialsOwned,
      recipeUnlocked: materialsOwned >= entry.materialsRequired
    }
  };
}

export function addRootedResult(collection, speciesId, trait = null, expressionId = null, isKeeper = false) {
  const entry = getOrCreateEntry(collection, speciesId, 1);
  const knownTraits = trait && !entry.knownTraits.includes(trait)
    ? [...entry.knownTraits, trait]
    : entry.knownTraits;
  const knownExpressions = expressionId && !entry.knownExpressions.includes(expressionId)
    ? [...entry.knownExpressions, expressionId]
    : entry.knownExpressions;

  return {
    ...collection,
    [speciesId]: {
      ...entry,
      rootedCount: entry.rootedCount + 1,
      knownTraits,
      knownExpressions,
      keeperFound: entry.keeperFound || isKeeper,
      vaultProgress: Math.max(entry.vaultProgress, isKeeper ? 75 : 55)
    }
  };
}
