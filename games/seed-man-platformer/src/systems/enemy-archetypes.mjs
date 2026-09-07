export const ENEMY_ARCHETYPES = Object.freeze({
  aphid: Object.freeze({ kind: 'aphid', rank: 'standard', movement: 'ground', attackPattern: 'contact', health: 2, width: 28, height: 24, moveSpeed: 56, drops: { nutrients: 1 } }),
  mite: Object.freeze({ kind: 'mite', rank: 'standard', movement: 'ground', attackPattern: 'contact', health: 2, width: 26, height: 22, moveSpeed: 68, drops: { trichomes: 1 } }),
  fungus: Object.freeze({ kind: 'fungus', rank: 'standard', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.8, health: 3, width: 32, height: 30, moveSpeed: 32, drops: { nutrients: 1, resin: 1 } }),
  thrip: Object.freeze({ kind: 'thrip', rank: 'standard', movement: 'ground', attackPattern: 'aimed-shot', attackCooldown: 2.25, health: 2, width: 26, height: 20, moveSpeed: 82, drops: { 'genetic-fragments': 1 } }),
  'fungus-gnat': Object.freeze({ kind: 'fungus-gnat', rank: 'standard', movement: 'flying', attackPattern: 'aimed-shot', attackCooldown: 2.35, health: 3, width: 32, height: 24, moveSpeed: 72, hoverAmplitude: 20, hoverFrequency: 2.6, drops: { nutrients: 2 } }),
  'pollen-wasp': Object.freeze({ kind: 'pollen-wasp', rank: 'standard', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 2.7, health: 3, width: 34, height: 24, moveSpeed: 96, hoverAmplitude: 26, hoverFrequency: 3.1, drops: { 'genetic-fragments': 2 } }),
  'warp-midge': Object.freeze({ kind: 'warp-midge', rank: 'standard', movement: 'blink', attackPattern: 'blink-strike', attackCooldown: 2.8, health: 3, width: 28, height: 24, moveSpeed: 54, blinkDistance: 120, blinkCooldown: 2.4, drops: { alleles: 1 } }),

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

  'minor-boss-aphid-brute': Object.freeze({ kind: 'aphid-brute', rank: 'minor-boss', movement: 'ground', attackPattern: 'dive-charge', attackCooldown: 2.1, health: 14, width: 58, height: 48, moveSpeed: 46, telegraphSeconds: 0.65, contactDamage: 2, drops: { nutrients: 6, resin: 4 } }),
  'minor-boss-tempest-hornet': Object.freeze({ kind: 'tempest-hornet', rank: 'minor-boss', movement: 'flying', attackPattern: 'dive-charge', attackCooldown: 1.95, health: 16, width: 64, height: 44, moveSpeed: 86, hoverAmplitude: 42, hoverFrequency: 2.1, telegraphSeconds: 0.7, contactDamage: 2, phenotypeReward: 'terpene-tempest', drops: { 'genetic-fragments': 6, alleles: 2 } }),
  'minor-boss-resin-golem': Object.freeze({ kind: 'resin-golem', rank: 'minor-boss', movement: 'ground', attackPattern: 'ground-wave', attackCooldown: 2.25, health: 18, width: 62, height: 58, moveSpeed: 34, telegraphSeconds: 0.8, contactDamage: 2, phenotypeReward: 'trichome-crystal', drops: { resin: 7, trichomes: 5 } }),

  'major-boss-queen-mite': Object.freeze({ kind: 'queen-mite', rank: 'major-boss', movement: 'ground', attackPattern: 'burst-shot', attackCooldown: 1.85, health: 28, width: 78, height: 66, moveSpeed: 44, telegraphSeconds: 0.9, phases: 3, contactDamage: 3, phenotypeReward: 'static-haze', drops: { trichomes: 10, 'genetic-fragments': 8, alleles: 2 } }),
  'major-boss-spore-seraph': Object.freeze({ kind: 'spore-seraph', rank: 'major-boss', movement: 'flying', attackPattern: 'radial-burst', attackCooldown: 2.15, health: 30, width: 82, height: 60, moveSpeed: 72, hoverAmplitude: 52, hoverFrequency: 1.9, telegraphSeconds: 1, phases: 3, contactDamage: 3, phenotypeReward: 'mycelium-mind', drops: { nutrients: 10, resin: 6, alleles: 3 } }),
  'major-boss-warp-weaver': Object.freeze({ kind: 'warp-weaver', rank: 'major-boss', movement: 'blink', attackPattern: 'blink-strike', attackCooldown: 1.6, health: 32, width: 80, height: 62, moveSpeed: 62, blinkDistance: 240, blinkCooldown: 1.25, telegraphSeconds: 0.85, phases: 4, contactDamage: 3, phenotypeReward: 'gravity-haze', drops: { 'genetic-fragments': 10, alleles: 5 } })
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
  'elite-gravity-midge'
]);

export const BOSS_ARCHETYPES = Object.freeze({
  minor: Object.freeze(['minor-boss-aphid-brute', 'minor-boss-tempest-hornet', 'minor-boss-resin-golem']),
  major: Object.freeze(['major-boss-queen-mite', 'major-boss-spore-seraph', 'major-boss-warp-weaver'])
});

export function instantiateEncounterSet(definitions = LEVEL_01_COMBAT_ENCOUNTERS) {
  return definitions.map((definition) => createEnemyFromArchetype(definition.archetype, definition));
}
