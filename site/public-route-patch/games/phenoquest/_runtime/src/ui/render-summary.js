export function summarizeMvpData(data) {
  const starters = data.starters?.length ?? 0;
  const extraUnits = data.extraUnits?.length ?? 0;
  const expressions = data.expressions?.length ?? 0;
  const quests = data.quests?.length ?? 0;
  const encounters = data.encounters?.encounters?.length ?? 0;
  const maps = data.maps?.length ?? 0;
  const dialogue = data.dialogue?.length ?? 0;
  const starterSlots = data.starterSlots?.length ?? 0;
  const items = data.items?.length ?? 0;
  const abilities = data.abilities?.length ?? 0;
  const weatherStates = data.weatherStates?.length ?? 0;
  const genotypeMarkers = data.genotypeMarkers?.length ?? 0;
  const pairingRules = data.pairingRules?.length ?? 0;
  const resultUnits = data.resultUnits?.length ?? 0;

  return [
    `Loaded starters: ${starters}`,
    `Loaded extra units: ${extraUnits}`,
    `Loaded expression states: ${expressions}`,
    `Loaded quests: ${quests}`,
    `Loaded Terp Fields encounters: ${encounters}`,
    `Loaded maps: ${maps}`,
    `Loaded dialogue records: ${dialogue}`,
    `Loaded starter slots: ${starterSlots}`,
    `Loaded items: ${items}`,
    `Loaded abilities: ${abilities}`,
    `Loaded weather states: ${weatherStates}`,
    `Loaded genotype markers: ${genotypeMarkers}`,
    `Loaded pairing rules: ${pairingRules}`,
    `Loaded future result units: ${resultUnits}`
  ].join('\n');
}

export function showPanel({ panel, titleEl, copyEl, debugEl, title, copy, debug = '' }) {
  panel?.classList.remove('hidden');
  if (titleEl) titleEl.textContent = title;
  if (copyEl) copyEl.textContent = copy;
  if (debugEl) debugEl.textContent = debug;
}
