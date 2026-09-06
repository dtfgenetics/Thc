export const ENEMY_ARCHETYPES = Object.freeze({
  aphid: Object.freeze({ kind: 'aphid', health: 2, width: 28, height: 24, moveSpeed: 56, drops: { nutrients: 1 } }),
  mite: Object.freeze({ kind: 'mite', health: 2, width: 26, height: 22, moveSpeed: 68, drops: { trichomes: 1 } }),
  fungus: Object.freeze({ kind: 'fungus', health: 3, width: 32, height: 30, moveSpeed: 32, drops: { nutrients: 1, resin: 1 } }),
  thrip: Object.freeze({ kind: 'thrip', health: 2, width: 26, height: 20, moveSpeed: 82, drops: { 'genetic-fragments': 1 } }),
  'elite-static-mite': Object.freeze({ kind: 'elite-static-mite', health: 6, width: 38, height: 34, moveSpeed: 72, phenotypeReward: 'static-haze', drops: { trichomes: 4, 'genetic-fragments': 2 } }),
  'elite-frost-aphid': Object.freeze({ kind: 'elite-frost-aphid', health: 6, width: 40, height: 34, moveSpeed: 54, phenotypeReward: 'frost-resin', drops: { resin: 3, alleles: 1 } }),
  'elite-solar-fungus': Object.freeze({ kind: 'elite-solar-fungus', health: 8, width: 44, height: 40, moveSpeed: 34, phenotypeReward: 'solar-flare', drops: { resin: 4, trichomes: 2 } })
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
  Object.freeze({ id: 'elite-static', archetype: 'elite-static-mite', x: 5150, y: 444, patrolMinX: 4980, patrolMaxX: 5450 }),
  Object.freeze({ id: 'late-fungus', archetype: 'fungus', x: 6300, y: 450, patrolMinX: 6200, patrolMaxX: 6640 })
]);

export function instantiateEncounterSet(definitions = LEVEL_01_COMBAT_ENCOUNTERS) {
  return definitions.map((definition) => createEnemyFromArchetype(definition.archetype, definition));
}
