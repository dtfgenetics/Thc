export const ENEMY_ARCHETYPES = Object.freeze({
  aphid: Object.freeze({ kind: 'aphid', rank: 'standard', movement: 'ground', attackPattern: 'contact', health: 2, width: 28, height: 24, moveSpeed: 56, drops: { nutrients: 1 } }),
  mite: Object.freeze({ kind: 'mite', rank: 'standard', movement: 'ground', attackPattern: 'contact', health: 2, width: 26, height: 22, moveSpeed: 68, drops: { trichomes: 1 } }),
  fungus: Object.freeze({ kind: 'fungus', rank: 'standard', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.8, health: 3, width: 32, height: 30, moveSpeed: 32, drops: { nutrients: 1, resin: 1 } }),
  thrip: Object.freeze({ kind: 'thrip', rank: 'standard', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.25, health: 2, width: 26, height: 20, moveSpeed: 82, drops: { 'genetic-fragments': 1 } }),
  'fungus-gnat': Object.freeze({ kind: 'fungus-gnat', rank: 'standard', movement: 'flying', attackPattern: 'aimed-shot', attackCooldown: 2.35, health: 3, width: 32, height: 24, moveSpeed: 72, hoverAmplitude: 20, hoverFrequency: 2.6, drops: { nutrients: 2 } }),
  'pollen-wasp': Object.freeze({ kind: 'pollen-wasp', rank: 'standard', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 2.7, health: 3, width: 34, height: 24, moveSpeed: 96, hoverAmplitude: 26, hoverFrequency: 3.1, drops: { 'genetic-fragments': 2 } }),
  'warp-midge': Object.freeze({ kind: 'warp-midge', rank: 'standard', movement: 'blink', attackPattern: 'blink-strike', attackCooldown: 2.8, health: 3, width: 28, height: 24, moveSpeed: 54, blinkDistance: 120, blinkCooldown: 2.4, drops: { alleles: 1 } }),
  'ember-beetle': Object.freeze({ kind: 'ember-beetle', rank: 'standard', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.15, health: 4, width: 34, height: 28, moveSpeed: 50, drops: { resin: 2 } }),
  'voltage-wasp': Object.freeze({ kind: 'voltage-wasp', rank: 'standard', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 2.25, health: 4, width: 36, height: 26, moveSpeed: 102, hoverAmplitude: 30, hoverFrequency: 3.2, drops: { 'genetic-fragments': 2, alleles: 1 } }),
  'cryo-moth': Object.freeze({ kind: 'cryo-moth', rank: 'standard', movement: 'flying', attackPattern: 'aimed-shot', attackCooldown: 2.4, health: 4, width: 38, height: 28, moveSpeed: 76, hoverAmplitude: 26, hoverFrequency: 2.4, drops: { trichomes: 2, resin: 1 } }),

  'elite-static-mite': Object.freeze({ kind: 'elite-static-mite', rank: 'elite', movement: 'ground', attackPattern: 'burst-shot', attackCooldown: 2.25, health: 6, width: 38, height: 34, moveSpeed: 72, phenotypeReward: 'static-haze', drops: { trichomes: 4, 'genetic-fragments': 2 } }),
  'elite-frost-aphid': Object.freeze({ kind: 'elite-frost-aphid', rank: 'elite', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.1, health: 6, width: 40, height: 34, moveSpeed: 54, phenotypeReward: 'frost-resin', drops: { resin: 3, alleles: 1 } }),
  'elite-solar-fungus': Object.freeze({ kind: 'elite-solar-fungus', rank: 'elite', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.6, health: 8, width: 44, height: 40, moveSpeed: 34, phenotypeReward: 'solar-flare', drops: { resin: 4, trichomes: 2 } }),
  'elite-hydro-beetle': Object.freeze({ kind: 'elite-hydro-beetle', rank: 'elite', movement: 'ground', attackPattern: 'burst-shot', attackCooldown: 2.5, health: 7, width: 42, height: 34, moveSpeed: 48, phenotypeReward: 'hydro-surge', drops: { nutrients: 3, resin: 2 } }),
  'elite-tempest-gnat': Object.freeze({ kind: 'elite-tempest-gnat', rank: 'elite', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 2.35, health: 7, width: 40, height: 30, moveSpeed: 92, hoverAmplitude: 34, hoverFrequency: 2.8, phenotypeReward: 'terpene-tempest', drops: { 'genetic-fragments': 3, alleles: 1 } }),
  'elite-vine-weevil': Object.freeze({ kind: 'elite-vine-weevil', rank: 'elite', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.45, health: 8, width: 42, height: 36, moveSpeed: 44, phenotypeReward: 'vine-lash', drops: { nutrients: 4, resin: 2 } }),
  'elite-mycelium-moth': Object.freeze({ kind: 'elite-mycelium-moth', rank: 'elite', movement: 'flying', attackPattern: 'burst-shot', attackCooldown: 2.45, health: 8, width: 44, height: 32, moveSpeed: 78, hoverAmplitude: 28, hoverFrequency: 2.2, phenotypeReward: 'mycelium-mind', drops: { trichomes: 3, nutrients: 3 } }),
  'elite-root-borer': Object.freeze({ kind: 'elite-root-borer', rank: 'elite', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.6, health: 9, width: 46, height: 38, moveSpeed: 40, phenotypeReward: 'rootbreaker', drops: { nutrients: 4, 'genetic-fragments': 2 } }),
  'elite-crystal-mite': Object.freeze({ kind: 'elite-crystal-mite', rank: 'elite', movement: 'ground', attackPattern: 'burst-shot', attackCooldown: 2.55, health: 9, width: 42, height: 36, moveSpeed: 58, phenotypeReward: 'trichome-crystal', drops: { trichomes: 5, resin: 2 } }),
  'elite-gravity-midge': Object.freeze({ kind: 'elite-gravity-midge', rank: 'elite', movement: 'blink', attackPattern: 'blink-strike', attackCooldown: 2.2, health: 8, width: 38, height: 30, moveSpeed: 70, blinkDistance: 180, blinkCooldown: 1.8, phenotypeReward: 'gravity-haze', drops: { alleles: 2, 'genetic-fragments': 3 } }),
  'elite-ember-beetle': Object.freeze({ kind: 'elite-ember-beetle', rank: 'elite', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.05, health: 10, width: 48, height: 40, moveSpeed: 48, phenotypeReward: 'solar-flare', drops: { resin: 5, trichomes: 3 } }),
  'elite-voltage-wasp': Object.freeze({ kind: 'elite-voltage-wasp', rank: 'elite', movement: 'flying', attackPattern: 'burst-shot', attackCooldown: 1.95, health: 10, width: 48, height: 34, moveSpeed: 108, hoverAmplitude: 38, hoverFrequency: 3.3, phenotypeReward: 'static-haze', drops: { 'genetic-fragments': 5, alleles: 2 } }),
  'elite-cryo-moth': Object.freeze({ kind: 'elite-cryo-moth', rank: 'elite', movement: 'flying', attackPattern: 'aimed-shot', attackCooldown: 2, health: 10, width: 50, height: 36, moveSpeed: 82, hoverAmplitude: 34, hoverFrequency: 2.3, phenotypeReward: 'frost-resin', drops: { trichomes: 5, resin: 3 } }),

  'minor-boss-aphid-brute': Object.freeze({ kind: 'aphid-brute', rank: 'minor-boss', movement: 'ground', attackPattern: 'dive-charge', attackCooldown: 2.1, health: 14, width: 58, height: 48, moveSpeed: 46, telegraphSeconds: 0.65, contactDamage: 2, drops: { nutrients: 6, resin: 4 } }),
  'minor-boss-tempest-hornet': Object.freeze({ kind: 'tempest-hornet', rank: 'minor-boss', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 1.95, health: 16, width: 64, height: 44, moveSpeed: 86, hoverAmplitude: 42, hoverFrequency: 2.1, telegraphSeconds: 0.7, contactDamage: 2, phenotypeReward: 'terpene-tempest', drops: { 'genetic-fragments': 6, alleles: 2 } }),
  'minor-boss-resin-golem': Object.freeze({ kind: 'resin-golem', rank: 'minor-boss', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.25, health: 18, width: 62, height: 58, moveSpeed: 34, telegraphSeconds: 0.8, contactDamage: 2, phenotypeReward: 'trichome-crystal', drops: { resin: 7, trichomes: 5 } }),
  'minor-boss-voltage-wasp-alpha': Object.freeze({ kind: 'voltage-wasp-alpha', rank: 'minor-boss', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 1.75, health: 20, width: 68, height: 48, moveSpeed: 112, hoverAmplitude: 46, hoverFrequency: 2.7, telegraphSeconds: 0.65, contactDamage: 2, phenotypeReward: 'static-haze', drops: { 'genetic-fragments': 7, alleles: 3 } }),

  'major-boss-queen-mite': Object.freeze({ kind: 'queen-mite', rank: 'major-boss', movement: 'ground', attackPattern: 'burst-shot', attackCooldown: 1.85, health: 28, width: 78, height: 66, moveSpeed: 44, telegraphSeconds: 0.9, phases: 3, contactDamage: 3, phenotypeReward: 'static-haze', drops: { trichomes: 10, 'genetic-fragments': 8, alleles: 2 } }),
  'major-boss-spore-seraph': Object.freeze({ kind: 'spore-seraph', rank: 'major-boss', movement: 'flying', attackPattern: 'radial-burst', attackCooldown: 2.15, health: 30, width: 82, height: 60, moveSpeed: 72, hoverAmplitude: 52, hoverFrequency: 1.9, telegraphSeconds: 1, phases: 3, contactDamage: 3, phenotypeReward: 'mycelium-mind', drops: { nutrients: 10, resin: 6, alleles: 3 } }),
  'major-boss-warp-weaver': Object.freeze({ kind: 'warp-weaver', rank: 'major-boss', movement: 'blink', attackPattern: 'blink-strike', attackCooldown: 1.6, health: 32, width: 80, height: 62, moveSpeed: 62, blinkDistance: 240, blinkCooldown: 1.25, telegraphSeconds: 0.85, phases: 4, contactDamage: 3, phenotypeReward: 'gravity-haze', drops: { 'genetic-fragments': 10, alleles: 5 } }),
  'major-boss-genome-hydra': Object.freeze({ kind: 'genome-hydra', rank: 'major-boss', movement: 'ground', attackPattern: 'radial-burst', attackCooldown: 1.45, health: 38, width: 98, height: 82, moveSpeed: 52, telegraphSeconds: 0.75, phases: 4, contactDamage: 3, phenotypeReward: 'gravity-haze', drops: { resin: 10, trichomes: 10, 'genetic-fragments': 10, alleles: 6 } })
});

export function createEnemyFromArchetype(archetypeId, placement = {}) {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  if (!archetype) throw new Error(`unknown enemy archetype: ${archetypeId}`);
  return {
    id: placement.id || `${archetypeId}-${Math.round(Number(placement.x) || 0)}`,
    ...archetype,
    x: Number(placement.x) || 0,
    y: Number(placement.y) || 0,
    vx: Number(placement.vx) || 0,
    vy: Number(placement.vy) || 0,
    patrolMinX: Number.isFinite(Number(placement.patrolMinX)) ? Number(placement.patrolMinX) : null,
    patrolMaxX: Number.isFinite(Number(placement.patrolMaxX)) ? Number(placement.patrolMaxX) : null
  };
}

export const LEVEL_01_COMBAT_ENCOUNTERS = Object.freeze([
  Object.freeze({ id: 'intro-aphid', archetype: 'aphid', x: 900, y: 456, patrolMinX: 820, patrolMaxX: 1080 }),
  Object.freeze({ id: 'bench-mite', archetype: 'mite', x: 1470, y: 366, patrolMinX: 1420, patrolMaxX: 1550 }),
  Object.freeze({ id: 'mid-fungus', archetype: 'fungus', x: 2210, y: 450, patrolMinX: 2100, patrolMaxX: 2470 }),
  Object.freeze({ id: 'fast-thrip', archetype: 'thrip', x: 3470, y: 450, patrolMinX: 3370, patrolMaxX: 3860 }),
  Object.freeze({ id: 'air-gnat', archetype: 'fungus-gnat', x: 4300, y: 350, patrolMinX: 4180, patrolMaxX: 4580 }),
  Object.freeze({ id: 'elite-static', archetype: 'elite-static-mite', x: 5150, y: 444, patrolMinX: 4980, patrolMaxX: 5450 }),
  Object.freeze({ id: 'late-fungus', archetype: 'fungus', x: 6300, y: 450, patrolMinX: 6200, patrolMaxX: 6640 })
]);

export const WORLD_05_COMBAT_ENCOUNTERS = Object.freeze({
  'chromosome-crossing': Object.freeze([
    Object.freeze({ id: 'chromosome-ember-1', archetype: 'ember-beetle', x: 1280, y: 446, patrolMinX: 1160, patrolMaxX: 1450 }),
    Object.freeze({ id: 'chromosome-voltage-1', archetype: 'voltage-wasp', x: 2550, y: 330, patrolMinX: 2350, patrolMaxX: 2820 }),
    Object.freeze({ id: 'chromosome-elite-fire', archetype: 'elite-ember-beetle', x: 4480, y: 438, patrolMinX: 4250, patrolMaxX: 4750 })
  ]),
  'mutation-marsh': Object.freeze([
    Object.freeze({ id: 'mutation-cryo-1', archetype: 'cryo-moth', x: 1500, y: 320, patrolMinX: 1320, patrolMaxX: 1760 }),
    Object.freeze({ id: 'mutation-voltage-1', archetype: 'voltage-wasp', x: 3150, y: 300, patrolMinX: 2940, patrolMaxX: 3440 }),
    Object.freeze({ id: 'mutation-alpha', archetype: 'minor-boss-voltage-wasp-alpha', x: 5200, y: 300, patrolMinX: 4950, patrolMaxX: 5550 })
  ]),
  'allele-array': Object.freeze([
    Object.freeze({ id: 'allele-ember-1', archetype: 'ember-beetle', x: 1750, y: 442, patrolMinX: 1580, patrolMaxX: 1980 }),
    Object.freeze({ id: 'allele-elite-electric', archetype: 'elite-voltage-wasp', x: 3600, y: 300, patrolMinX: 3380, patrolMaxX: 3920 }),
    Object.freeze({ id: 'allele-elite-ice', archetype: 'elite-cryo-moth', x: 5250, y: 310, patrolMinX: 5020, patrolMaxX: 5580 })
  ]),
  'genome-spire': Object.freeze([
    Object.freeze({ id: 'spire-elite-fire', archetype: 'elite-ember-beetle', x: 1650, y: 438, patrolMinX: 1450, patrolMaxX: 1950 }),
    Object.freeze({ id: 'spire-elite-electric', archetype: 'elite-voltage-wasp', x: 3050, y: 290, patrolMinX: 2820, patrolMaxX: 3380 }),
    Object.freeze({ id: 'spire-elite-ice', archetype: 'elite-cryo-moth', x: 4450, y: 300, patrolMinX: 4200, patrolMaxX: 4760 }),
    Object.freeze({ id: 'spire-genome-hydra', archetype: 'major-boss-genome-hydra', x: 5850, y: 392, patrolMinX: 5580, patrolMaxX: 6250 })
  ])
});

export const CAMPAIGN_PHENOTYPE_CARRIERS = Object.freeze([
  'elite-solar-fungus',
  'elite-frost-aphid',
  'elite-static-mite',
  'elite-hydro-beetle',
  'elite-tempest-gnat',
  'elite-vine-weevil',
  'elite-mycelium-moth',
  'elite-root-borer',
  'elite-crystal-mite',
  'elite-gravity-midge',
  'elite-ember-beetle',
  'elite-voltage-wasp',
  'elite-cryo-moth'
]);

export const BOSS_ARCHETYPES = Object.freeze({
  minor: Object.freeze(['minor-boss-aphid-brute', 'minor-boss-tempest-hornet', 'minor-boss-resin-golem', 'minor-boss-voltage-wasp-alpha']),
  major: Object.freeze(['major-boss-queen-mite', 'major-boss-spore-seraph', 'major-boss-warp-weaver', 'major-boss-genome-hydra'])
});

export function instantiateEncounterSet(definitions = LEVEL_01_COMBAT_ENCOUNTERS) {
  return definitions.map((definition) => createEnemyFromArchetype(definition.archetype, definition));
}
