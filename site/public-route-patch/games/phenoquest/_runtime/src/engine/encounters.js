export function isEncounterEligible(encounter, state) {
  if (encounter.storyOnly && !state.flags?.[encounter.storyFlag]) {
    return false;
  }

  if (encounter.weather?.length && !encounter.weather.includes(state.weather)) {
    return false;
  }

  if (encounter.cues?.length && !encounter.cues.includes(state.cue)) {
    return false;
  }

  return encounter.weight > 0 || Boolean(encounter.storyOnly);
}

export function getEligibleEncounters(regionData, state) {
  return regionData.encounters.filter((encounter) => isEncounterEligible(encounter, state));
}

export function pickWeightedEncounter(encounters, random = Math.random) {
  const totalWeight = encounters.reduce((sum, encounter) => sum + Math.max(0, encounter.weight), 0);
  if (totalWeight <= 0) return encounters[0] ?? null;

  let roll = random() * totalWeight;
  for (const encounter of encounters) {
    roll -= Math.max(0, encounter.weight);
    if (roll <= 0) return encounter;
  }

  return encounters.at(-1) ?? null;
}

export function rollEncounter(regionData, state, random = Math.random) {
  const eligible = getEligibleEncounters(regionData, state);
  return pickWeightedEncounter(eligible, random);
}

export function rollLevel(encounter, random = Math.random) {
  const min = encounter.minLevel ?? 1;
  const max = encounter.maxLevel ?? min;
  return min + Math.floor(random() * (max - min + 1));
}
