import { CANONICAL_PHENOTYPE_IDS } from './phenotypes.mjs';

export const RESOURCE_TYPES = Object.freeze(['resin', 'trichomes', 'nutrients', 'genetic-fragments', 'alleles']);
export const DEFAULT_PHENOTYPE_ABSORB_SECONDS = 30;
const TEMPORARY_PHENOTYPES = Object.freeze(['fire','electric','ice']);

export function createProgressionState() {
  return {
    activePhenotype: 'plant',
    absorbedPhenotype: null,
    absorbedPhenotypeRemaining: 0,
    discoveredPhenotypes: ['plant'],
    weapons: [],
    equippedWeapon: null,
    resources: Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0]))
  };
}

function canonicalPhenotype(id, {temporaryOnly=false}={}) {
  if (!id || !CANONICAL_PHENOTYPE_IDS.includes(id)) throw new Error(`unknown phenotype: ${id}`);
  if (temporaryOnly && !TEMPORARY_PHENOTYPES.includes(id)) throw new Error(`phenotype cannot be absorbed temporarily: ${id}`);
  return id;
}

export function normalizeProgressionState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const state = createProgressionState();
  state.activePhenotype = 'plant';
  const absorbed = TEMPORARY_PHENOTYPES.includes(source.absorbedPhenotype) ? source.absorbedPhenotype : null;
  const remaining = Number(source.absorbedPhenotypeRemaining);
  state.absorbedPhenotype = absorbed;
  state.absorbedPhenotypeRemaining = absorbed && Number.isFinite(remaining) && remaining > 0 ? Math.min(DEFAULT_PHENOTYPE_ABSORB_SECONDS, remaining) : 0;
  if (state.absorbedPhenotypeRemaining <= 0) state.absorbedPhenotype = null;
  const discovered = Array.isArray(source.discoveredPhenotypes) ? source.discoveredPhenotypes.filter((id)=>CANONICAL_PHENOTYPE_IDS.includes(id)) : [];
  state.discoveredPhenotypes = [...new Set(['plant', ...discovered])];
  state.weapons = Array.isArray(source.weapons) ? [...new Set(source.weapons)] : [];
  state.equippedWeapon = state.weapons.includes(source.equippedWeapon) ? source.equippedWeapon : (state.weapons[0] || null);
  for (const type of RESOURCE_TYPES) {
    const value = Number(source.resources?.[type]);
    state.resources[type] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return state;
}

export function acquirePhenotype(inputState, phenotypeId) {
  const id = canonicalPhenotype(phenotypeId);
  if (id !== 'plant') return absorbPhenotype(inputState,id);
  return normalizeProgressionState(inputState);
}

export function absorbPhenotype(inputState, phenotypeId, seconds = DEFAULT_PHENOTYPE_ABSORB_SECONDS) {
  const id = canonicalPhenotype(phenotypeId,{temporaryOnly:true});
  const state = normalizeProgressionState(inputState);
  if (!state.discoveredPhenotypes.includes(id)) state.discoveredPhenotypes.push(id);
  state.absorbedPhenotype = id;
  const duration = Number(seconds);
  state.absorbedPhenotypeRemaining = Number.isFinite(duration) && duration > 0 ? Math.min(DEFAULT_PHENOTYPE_ABSORB_SECONDS,duration) : DEFAULT_PHENOTYPE_ABSORB_SECONDS;
  return state;
}

export function stepPhenotypeAbsorption(inputState, dt) {
  const state = normalizeProgressionState(inputState);
  if (!state.absorbedPhenotype) return state;
  const step = Math.max(0, Number(dt) || 0);
  state.absorbedPhenotypeRemaining = Math.max(0, state.absorbedPhenotypeRemaining - step);
  if (state.absorbedPhenotypeRemaining <= 0) {
    state.absorbedPhenotype = null;
    state.absorbedPhenotypeRemaining = 0;
  }
  return state;
}

export function getEffectivePhenotype(inputState) {
  const state = normalizeProgressionState(inputState);
  return state.absorbedPhenotype || 'plant';
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
