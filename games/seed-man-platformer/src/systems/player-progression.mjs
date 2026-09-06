export const RESOURCE_TYPES = Object.freeze(['resin', 'trichomes', 'nutrients', 'genetic-fragments', 'alleles']);

export function createProgressionState() {
  return {
    activePhenotype: null,
    discoveredPhenotypes: [],
    weapons: [],
    equippedWeapon: null,
    resources: Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0]))
  };
}

export function normalizeProgressionState(input = {}) {
  const state = createProgressionState();
  state.activePhenotype = input.activePhenotype || null;
  state.discoveredPhenotypes = Array.isArray(input.discoveredPhenotypes) ? [...new Set(input.discoveredPhenotypes)] : [];
  state.weapons = Array.isArray(input.weapons) ? [...new Set(input.weapons)] : [];
  state.equippedWeapon = state.weapons.includes(input.equippedWeapon) ? input.equippedWeapon : (state.weapons[0] || null);
  for (const type of RESOURCE_TYPES) {
    const value = Number(input.resources?.[type]);
    state.resources[type] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return state;
}

export function acquirePhenotype(inputState, phenotypeId) {
  if (!phenotypeId) throw new Error('phenotype id is required');
  const state = normalizeProgressionState(inputState);
  if (!state.discoveredPhenotypes.includes(phenotypeId)) state.discoveredPhenotypes.push(phenotypeId);
  state.activePhenotype = phenotypeId;
  return state;
}

export function collectWeapon(inputState, weaponId, { autoEquip = true } = {}) {
  if (!weaponId) throw new Error('weapon id is required');
  const state = normalizeProgressionState(inputState);
  if (!state.weapons.includes(weaponId)) state.weapons.push(weaponId);
  if (autoEquip || !state.equippedWeapon) state.equippedWeapon = weaponId;
  return state;
}

export function equipWeapon(inputState, weaponId) {
  const state = normalizeProgressionState(inputState);
  if (!state.weapons.includes(weaponId)) throw new Error(`weapon not owned: ${weaponId}`);
  state.equippedWeapon = weaponId;
  return state;
}

export function collectResource(inputState, type, amount = 1) {
  if (!RESOURCE_TYPES.includes(type)) throw new Error(`unknown resource type: ${type}`);
  const quantity = Math.max(0, Math.floor(Number(amount) || 0));
  const state = normalizeProgressionState(inputState);
  state.resources[type] += quantity;
  return state;
}
