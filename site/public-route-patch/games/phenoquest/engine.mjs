export const TRAITS = [
  { id: 'vigor', label: 'Vigor' },
  { id: 'branching', label: 'Branching' },
  { id: 'resin', label: 'Resin' },
  { id: 'aroma', label: 'Aroma' },
  { id: 'pigment', label: 'Pigment' },
  { id: 'finish', label: 'Finish Speed' }
];

export const ENVIRONMENTS = [
  { id: 'stable', label: 'Stable Chamber', note: 'Neutral expression baseline.', modifiers: {} },
  { id: 'cool', label: 'Cool Expression', note: 'Toy-model shift toward pigment and aroma expression.', modifiers: { pigment: 12, aroma: 5, vigor: -4 } },
  { id: 'warm', label: 'Warm Expression', note: 'Toy-model shift toward vigor and finish speed.', modifiers: { vigor: 8, finish: 6, pigment: -8 } },
  { id: 'challenge', label: 'Challenge Chamber', note: 'Higher expression variability without changing genotype.', modifiers: { vigor: -8, branching: -4 }, noise: 11 }
];

export const MISSIONS = [
  { id: 'balanced', name: 'Balanced Keeper', brief: 'Bank useful all-around expressions while protecting diversity.', weights: { vigor: .2, branching: .18, resin: .18, aroma: .16, pigment: .12, finish: .16 } },
  { id: 'resin', name: 'Resin Research', brief: 'Prioritize resin expression without collapsing the rest of the line.', weights: { vigor: .14, branching: .14, resin: .36, aroma: .16, pigment: .08, finish: .12 } },
  { id: 'pigment', name: 'Color Archive', brief: 'Explore pigment expression while keeping a functional, varied vault.', weights: { vigor: .14, branching: .14, resin: .12, aroma: .18, pigment: .34, finish: .08 } },
  { id: 'fast', name: 'Fast-Cycle Search', brief: 'Favor finish speed and vigor while preserving multiple allele combinations.', weights: { vigor: .22, branching: .12, resin: .12, aroma: .1, pigment: .08, finish: .36 } }
];

export function makeRng(seed = 1) {
  let value = (Number(seed) >>> 0) || 1;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function allele(rng) {
  return Math.floor(rng() * 4);
}

export function createFounderPopulation(count = 6, rng = Math.random) {
  return Array.from({ length: count }, (_, index) => ({
    id: `F0-${index + 1}-${Math.floor(rng() * 1e7).toString(36)}`,
    generation: 1,
    origin: 'Founder',
    genotype: Object.fromEntries(TRAITS.map(trait => [trait.id, [allele(rng), allele(rng)]]))
  }));
}

export function expressPlant(plant, environmentId = 'stable', rng = Math.random) {
  const environment = ENVIRONMENTS.find(item => item.id === environmentId) || ENVIRONMENTS[0];
  const noiseRange = environment.noise ?? 6;
  const phenotype = {};
  for (const trait of TRAITS) {
    const pair = plant.genotype[trait.id] || [0, 0];
    const geneticBase = ((pair[0] + pair[1]) / 6) * 100;
    const modifier = environment.modifiers?.[trait.id] || 0;
    const noise = (rng() * 2 - 1) * noiseRange;
    phenotype[trait.id] = Math.round(clamp(geneticBase + modifier + noise));
  }
  return phenotype;
}

export function clonePopulation(parent, count = 6, generation = 2, rng = Math.random) {
  return Array.from({ length: count }, (_, index) => ({
    id: `G${generation}-C${index + 1}-${Math.floor(rng() * 1e7).toString(36)}`,
    generation,
    origin: `Clone of ${parent.id}`,
    genotype: structuredClone(parent.genotype)
  }));
}

export function crossPlants(parentA, parentB, count = 6, generation = 2, rng = Math.random) {
  return Array.from({ length: count }, (_, index) => {
    const genotype = {};
    for (const trait of TRAITS) {
      const a = parentA.genotype[trait.id];
      const b = parentB.genotype[trait.id];
      genotype[trait.id] = [a[Math.floor(rng() * 2)], b[Math.floor(rng() * 2)]];
    }
    return {
      id: `G${generation}-X${index + 1}-${Math.floor(rng() * 1e7).toString(36)}`,
      generation,
      origin: `${parentA.id} × ${parentB.id}`,
      genotype
    };
  });
}

export function missionFit(phenotype, missionId = 'balanced') {
  const mission = MISSIONS.find(item => item.id === missionId) || MISSIONS[0];
  let total = 0;
  for (const trait of TRAITS) total += (phenotype[trait.id] || 0) * (mission.weights[trait.id] || 0);
  return Math.round(clamp(total));
}

export function genotypeSignature(plant) {
  return TRAITS.map(trait => [...plant.genotype[trait.id]].sort((a, b) => a - b).join('')).join('-');
}

export function diversityScore(plants = []) {
  if (!plants.length) return 0;
  let total = 0;
  for (const trait of TRAITS) {
    const seen = new Set();
    for (const plant of plants) for (const value of plant.genotype[trait.id] || []) seen.add(value);
    total += seen.size / 4;
  }
  return Math.round((total / TRAITS.length) * 100);
}

export function finalVaultScore({ archive = [], selectionScore = 0 } = {}) {
  const plants = archive.map(entry => entry.plant || entry).filter(Boolean);
  const diversity = diversityScore(plants);
  const uniqueLines = new Set(plants.map(genotypeSignature)).size;
  return Math.round(selectionScore + diversity * 2 + uniqueLines * 25);
}
