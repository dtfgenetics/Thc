const standard = (definition) => Object.freeze({ rank:'standard', contactDamage:1, telegraphSeconds:0.45, ...definition });
const elite = (definition) => Object.freeze({ rank:'elite', contactDamage:1, telegraphSeconds:0.6, ...definition });
const boss = (definition) => Object.freeze({ rank:'major-boss', contactDamage:3, telegraphSeconds:0.8, ...definition });

export const ENEMY_ARCHETYPES = Object.freeze({
  'sproutling': standard({ kind:'sproutling', movement:'ground', attackPattern:'contact', health:2, width:34, height:32, moveSpeed:48, drops:{resin:1} }),
  'root-crawler': standard({ kind:'root-crawler', movement:'ground', attackPattern:'ground-wave', health:3, width:40, height:26, moveSpeed:42, drops:{nutrients:1} }),
  'toxic-spore': standard({ kind:'toxic-spore', movement:'ground', attackPattern:'aimed-shot', attackCooldown:2.4, health:3, width:38, height:40, moveSpeed:24, drops:{nutrients:2} }),
  'drone-bot': standard({ kind:'drone-bot', movement:'flying', attackPattern:'burst-shot', attackCooldown:2.3, health:4, width:42, height:30, moveSpeed:72, hoverAmplitude:26, hoverFrequency:2.4, drops:{'genetic-fragments':1} }),
  'thorn-beetle': standard({ kind:'thorn-beetle', movement:'ground', attackPattern:'dive-charge', attackCooldown:2.4, health:5, width:46, height:34, moveSpeed:64, drops:{resin:2} }),
  'sky-wasp': standard({ kind:'sky-wasp', movement:'flying', attackPattern:'dive-charge', attackCooldown:2.2, health:4, width:38, height:28, moveSpeed:90, hoverAmplitude:30, hoverFrequency:3.0, drops:{trichomes:2} }),
  'spike-plant': standard({ kind:'spike-plant', movement:'ground', attackPattern:'aimed-shot', attackCooldown:2.1, health:5, width:44, height:50, moveSpeed:0, drops:{nutrients:2} }),
  'sludge-monster': standard({ kind:'sludge-monster', movement:'ground', attackPattern:'ground-wave', attackCooldown:2.5, health:8, width:58, height:48, moveSpeed:30, drops:{resin:3} }),
  'bone-weed': standard({ kind:'bone-weed', movement:'ground', attackPattern:'radial-burst', attackCooldown:2.55, health:6, width:46, height:48, moveSpeed:38, drops:{trichomes:3} }),
  'shadow-root': standard({ kind:'shadow-root', movement:'blink', attackPattern:'blink-strike', attackCooldown:2.15, health:7, width:44, height:46, moveSpeed:50, blinkDistance:160, blinkCooldown:1.9, drops:{'genetic-fragments':2} }),

  'fire-carrier': elite({ kind:'fire-carrier', movement:'ground', attackPattern:'ground-wave', attackCooldown:2.15, health:7, width:48, height:36, moveSpeed:66, phenotypeReward:'fire', drops:{resin:3,alleles:1} }),
  'electric-carrier': elite({ kind:'electric-carrier', movement:'flying', attackPattern:'burst-shot', attackCooldown:1.95, health:6, width:44, height:32, moveSpeed:82, hoverAmplitude:32, hoverFrequency:2.8, phenotypeReward:'electric', drops:{'genetic-fragments':3,alleles:1} }),
  'ice-carrier': elite({ kind:'ice-carrier', movement:'ground', attackPattern:'aimed-shot', attackCooldown:2.05, health:6, width:42, height:30, moveSpeed:46, phenotypeReward:'ice', drops:{trichomes:3,alleles:1} }),

  'overgrown-guardian': boss({ kind:'overgrown-guardian', movement:'ground', attackPattern:'ground-wave', attackCooldown:1.8, health:32, width:110, height:98, moveSpeed:42, phases:3, drops:{resin:6,'genetic-fragments':3} }),
  'ancient-dryad': boss({ kind:'ancient-dryad', movement:'ground', attackPattern:'radial-burst', attackCooldown:1.75, health:36, width:116, height:104, moveSpeed:38, phases:3, drops:{nutrients:7,alleles:2} }),
  'scorchroot-titan': boss({ kind:'scorchroot-titan', movement:'ground', attackPattern:'ground-wave', attackCooldown:1.65, health:40, width:122, height:108, moveSpeed:44, phases:3, drops:{resin:8,trichomes:4} }),
  'frostbite-colossus': boss({ kind:'frostbite-colossus', movement:'ground', attackPattern:'radial-burst', attackCooldown:1.6, health:44, width:126, height:112, moveSpeed:36, phases:3, drops:{trichomes:8,alleles:3} }),
  'eco-sentinel': boss({ kind:'eco-sentinel', movement:'ground', attackPattern:'burst-shot', attackCooldown:1.5, health:48, width:118, height:106, moveSpeed:52, phases:3, drops:{'genetic-fragments':8,alleles:3} }),
  'blight-king': boss({ kind:'blight-king', movement:'blink', attackPattern:'radial-burst', attackCooldown:1.35, health:96, width:138, height:126, moveSpeed:58, blinkDistance:220, blinkCooldown:1.4, phases:4, finalBoss:true, drops:{resin:10,trichomes:10,'genetic-fragments':10,alleles:6} })
});

export const PHENOTYPE_CARRIER_ARCHETYPES = Object.freeze(['fire-carrier','electric-carrier','ice-carrier']);
export const BOSS_ARCHETYPES = Object.freeze(['overgrown-guardian','ancient-dryad','scorchroot-titan','frostbite-colossus','eco-sentinel','blight-king']);

export const LEVEL_01_COMBAT_ENCOUNTERS = Object.freeze([
  Object.freeze({ id:'sprout-steps-1', archetype:'sproutling', x:900, y:448, patrolMinX:800, patrolMaxX:1120 }),
  Object.freeze({ id:'sprout-steps-2', archetype:'root-crawler', x:1540, y:454, patrolMinX:1450, patrolMaxX:1770 }),
  Object.freeze({ id:'sprout-steps-3', archetype:'toxic-spore', x:2480, y:440, patrolMinX:2360, patrolMaxX:2660 }),
  Object.freeze({ id:'sprout-steps-4', archetype:'drone-bot', x:3560, y:320, patrolMinX:3400, patrolMaxX:3880 }),
  Object.freeze({ id:'sprout-steps-5', archetype:'thorn-beetle', x:4920, y:446, patrolMinX:4760, patrolMaxX:5210 })
]);

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

export function instantiateEncounterSet(definitions = LEVEL_01_COMBAT_ENCOUNTERS) {
  return definitions.map((definition) => createEnemyFromArchetype(definition.archetype, definition));
}
