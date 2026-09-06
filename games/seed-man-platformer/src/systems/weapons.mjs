export const WEAPONS = Object.freeze({
  'seed-slinger': Object.freeze({ id: 'seed-slinger', mode: 'rapid', cooldown: 0.18, projectile: 'seed-round', damage: 1, speed: 560 }),
  'rosin-cannon': Object.freeze({ id: 'rosin-cannon', mode: 'heavy', cooldown: 0.8, projectile: 'rosin-bomb', damage: 4, speed: 330 }),
  'pollen-blaster': Object.freeze({ id: 'pollen-blaster', mode: 'spread', cooldown: 0.45, projectile: 'pollen-shot', damage: 1, speed: 430, pellets: 3 }),
  'trichome-rifle': Object.freeze({ id: 'trichome-rifle', mode: 'precision', cooldown: 0.5, projectile: 'trichome-round', damage: 3, speed: 720, pierce: 2 }),
  'spore-launcher': Object.freeze({ id: 'spore-launcher', mode: 'arc', cooldown: 0.7, projectile: 'spore-grenade', damage: 2, speed: 300 }),
  'terp-beam': Object.freeze({ id: 'terp-beam', mode: 'beam', cooldown: 0.12, projectile: 'terp-pulse', damage: 1, speed: 820 })
});

export function getWeapon(id) {
  return WEAPONS[id] || null;
}

export function createWeaponShot(weaponId, { x = 0, y = 0, facing = 1, phenotype = null } = {}) {
  const weapon = getWeapon(weaponId);
  if (!weapon) throw new Error(`unknown weapon: ${weaponId}`);
  const direction = facing < 0 ? -1 : 1;
  return {
    weaponId,
    projectile: weapon.projectile,
    x,
    y,
    vx: weapon.speed * direction,
    damage: weapon.damage,
    mode: weapon.mode,
    pellets: weapon.pellets || 1,
    pierce: weapon.pierce || 0,
    phenotype
  };
}
