export const PHENOTYPES = Object.freeze({
  'solar-flare': Object.freeze({ id: 'solar-flare', family: 'elemental', element: 'fire', primary: 'fireball', passive: 'burn-resistance' }),
  'frost-resin': Object.freeze({ id: 'frost-resin', family: 'elemental', element: 'frost', primary: 'freeze-shot', passive: 'ice-traction' }),
  'static-haze': Object.freeze({ id: 'static-haze', family: 'elemental', element: 'electric', primary: 'chain-lightning', passive: 'charge-machinery' }),
  'hydro-surge': Object.freeze({ id: 'hydro-surge', family: 'elemental', element: 'water', primary: 'water-cannon', passive: 'water-mobility' }),
  'terpene-tempest': Object.freeze({ id: 'terpene-tempest', family: 'elemental', element: 'wind', primary: 'gust-shot', passive: 'air-control' }),
  'vine-lash': Object.freeze({ id: 'vine-lash', family: 'nature', element: 'growth', primary: 'vine-whip', passive: 'grapple-vines' }),
  'mycelium-mind': Object.freeze({ id: 'mycelium-mind', family: 'nature', element: 'fungal', primary: 'spore-burst', passive: 'reveal-secrets' }),
  'rootbreaker': Object.freeze({ id: 'rootbreaker', family: 'nature', element: 'root', primary: 'root-eruption', passive: 'root-grapple' }),
  'trichome-crystal': Object.freeze({ id: 'trichome-crystal', family: 'nature', element: 'crystal', primary: 'crystal-shard', passive: 'resin-armor' }),
  'gravity-haze': Object.freeze({ id: 'gravity-haze', family: 'superpower', element: 'gravity', primary: 'gravity-orb', passive: 'low-gravity' })
});

export const PHENOTYPE_ABILITIES = Object.freeze({
  'solar-flare': Object.freeze({ type: 'projectile', action: 'fireball', cooldown: 0.52 }),
  'frost-resin': Object.freeze({ type: 'projectile', action: 'freeze-shot', cooldown: 0.42 }),
  'static-haze': Object.freeze({ type: 'projectile', action: 'chain-lightning', cooldown: 0.48 }),
  'hydro-surge': Object.freeze({ type: 'form', action: 'bubble-form', cooldown: 2.4, duration: 5, shieldHits: 1, buoyancy: 0.42 }),
  'terpene-tempest': Object.freeze({ type: 'form', action: 'flight-burst', cooldown: 2.8, duration: 4.5, liftAcceleration: 930, maxRiseSpeed: 360 }),
  'vine-lash': Object.freeze({ type: 'melee', action: 'vine-whip', cooldown: 0.45, range: 118, damage: 2, pull: 150 }),
  'mycelium-mind': Object.freeze({ type: 'projectile', action: 'spore-burst', cooldown: 0.58 }),
  'rootbreaker': Object.freeze({ type: 'ground', action: 'root-eruption', cooldown: 0.85, range: 150, damage: 2, launch: -210 }),
  'trichome-crystal': Object.freeze({ type: 'projectile', action: 'crystal-shard', cooldown: 0.56 }),
  'gravity-haze': Object.freeze({ type: 'movement', action: 'forward-warp', cooldown: 1.8, distance: 280, invulnerability: 0.18 })
});

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
    fireball: { speed: 430, damage: 2, effect: 'burn' },
    'freeze-shot': { speed: 390, damage: 1, effect: 'freeze' },
    'chain-lightning': { speed: 520, damage: 1, effect: 'chain' },
    'water-cannon': { speed: 460, damage: 1, effect: 'push' },
    'gust-shot': { speed: 500, damage: 1, effect: 'gust' },
    'spore-burst': { speed: 300, damage: 1, effect: 'spore-cloud' },
    'crystal-shard': { speed: 560, damage: 2, effect: 'pierce' },
    'gravity-orb': { speed: 260, damage: 1, effect: 'lift' }
  };
  const projectile = projectileByAbility[phenotype.primary];
  if (!projectile) return null;
  return { phenotypeId: id, ability: phenotype.primary, vx: projectile.speed * (facing < 0 ? -1 : 1), ...projectile };
}
