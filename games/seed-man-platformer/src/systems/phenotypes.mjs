export const PHENOTYPES = Object.freeze({
  plant: Object.freeze({ id:'plant', family:'base', element:'plant', primary:'seed-shot', passive:'none', durationSeconds:0 }),
  fire: Object.freeze({ id:'fire', family:'elemental', element:'fire', primary:'fireball', passive:'burn-resistance', durationSeconds:30 }),
  electric: Object.freeze({ id:'electric', family:'elemental', element:'electric', primary:'chain-lightning', passive:'charge-machinery', durationSeconds:30 }),
  ice: Object.freeze({ id:'ice', family:'elemental', element:'ice', primary:'freeze-shot', passive:'ice-traction', durationSeconds:30 })
});

export const PHENOTYPE_ABILITIES = Object.freeze({
  plant: Object.freeze({ type:'projectile', action:'seed-shot', cooldown:0.32 }),
  fire: Object.freeze({ type:'projectile', action:'fireball', cooldown:0.42 }),
  electric: Object.freeze({ type:'projectile', action:'chain-lightning', cooldown:0.38 }),
  ice: Object.freeze({ type:'projectile', action:'freeze-shot', cooldown:0.40 })
});

export const CANONICAL_PHENOTYPE_IDS = Object.freeze(['plant','fire','electric','ice']);

export function getPhenotype(id) {
  return PHENOTYPES[id] || null;
}

export function getPhenotypeAbility(id) {
  return PHENOTYPE_ABILITIES[id] || null;
}

export function phenotypeProjectile(id, facing = 1) {
  const phenotype = getPhenotype(id);
  if (!phenotype) return null;
  const projectileByAbility = {
    'seed-shot': { speed:460, damage:1, effect:'pierce' },
    fireball: { speed:560, damage:2, effect:'burn' },
    'chain-lightning': { speed:660, damage:1, effect:'chain' },
    'freeze-shot': { speed:520, damage:1, effect:'freeze' }
  };
  const projectile = projectileByAbility[phenotype.primary];
  if (!projectile) return null;
  return { phenotypeId:id, ability:phenotype.primary, vx:projectile.speed*(facing<0?-1:1), ...projectile };
}
