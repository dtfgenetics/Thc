import { getClassMultiplier } from './class-chart.js';
import { addStatus, hasStatus } from './status-effects.js';

export function createCombatant(unit, level = 1) {
  return {
    unitId: unit.id,
    displayName: unit.displayName,
    classes: unit.classes,
    level,
    maxVigor: unit.baseStats.vigor + level * 2,
    vigor: unit.baseStats.vigor + level * 2,
    stability: unit.baseStats.stability,
    stats: { ...unit.baseStats },
    statuses: []
  };
}

export function calculateDamage({ attacker, defender, ability }) {
  const basePower = ability.power ?? 0;
  if (basePower <= 0) return 0;

  const attackStat = ability.category === 'special' ? attacker.stats.terps : attacker.stats.power;
  const defenseStat = defender.stats.roots;
  const classMultiplier = getClassMultiplier(attacker.classes, defender.classes);
  const shieldMultiplier = hasStatus(defender, 'shielded') ? 0.5 : 1;

  const raw = basePower + attackStat - Math.floor(defenseStat / 2);
  return Math.max(1, Math.round(raw * classMultiplier * shieldMultiplier));
}

export function applyDamage(combatant, amount) {
  return {
    ...combatant,
    vigor: Math.max(0, combatant.vigor - amount)
  };
}

export function applyStabilityChange(combatant, amount) {
  return {
    ...combatant,
    stability: Math.max(0, combatant.stability + amount)
  };
}

export function applyStatChange(combatant, stat, amount) {
  return {
    ...combatant,
    stats: {
      ...combatant.stats,
      [stat]: Math.max(1, (combatant.stats[stat] ?? 1) + amount)
    }
  };
}

export function isDefeated(combatant) {
  return combatant.vigor <= 0;
}

export function resolveAbility({ attacker, defender, ability }) {
  const damage = calculateDamage({ attacker, defender, ability });
  let nextAttacker = attacker;
  let nextDefender = applyDamage(defender, damage);
  const notes = [];

  if (ability.effect === 'self_stability_down') {
    nextAttacker = applyStabilityChange(nextAttacker, -1);
    notes.push(`${attacker.displayName} lost 1 Stability.`);
  }

  if (ability.effect === 'raise_defense_restore_stability') {
    nextAttacker = applyStabilityChange(nextAttacker, 2);
    nextAttacker = applyStatChange(nextAttacker, 'roots', 1);
    notes.push(`${attacker.displayName} restored Stability.`);
  }

  if (ability.effect === 'shield_next_hit') {
    nextAttacker = addStatus(nextAttacker, 'shielded');
    notes.push(`${attacker.displayName} became Shielded.`);
  }

  if (ability.effect === 'small_chance_aroma_bonus') {
    nextAttacker = addStatus(nextAttacker, 'aroma_charged');
    notes.push(`${attacker.displayName} became Aroma Charged.`);
  }

  if (ability.effect === 'target_stability_down') {
    nextDefender = applyStabilityChange(nextDefender, -1);
    nextDefender = addStatus(nextDefender, 'unstable');
    notes.push(`${defender.displayName} lost 1 Stability and became Unstable.`);
  }

  if (ability.effect === 'lower_target_terps') {
    nextDefender = applyStatChange(nextDefender, 'terps', -1);
    nextDefender = addStatus(nextDefender, 'wilted');
    notes.push(`${defender.displayName}'s Terps dropped and it became Wilted.`);
  }

  if (ability.effect === 'lower_target_speed') {
    nextDefender = applyStatChange(nextDefender, 'speed', -1);
    nextDefender = addStatus(nextDefender, 'rootbound');
    notes.push(`${defender.displayName}'s Speed dropped and it became Rootbound.`);
  }

  if (ability.effect === 'block_items_one_turn') {
    nextDefender = addStatus(nextDefender, 'locked_out');
    notes.push(`${defender.displayName} became Locked Out.`);
  }

  return {
    attacker: nextAttacker,
    defender: nextDefender,
    log: [`${attacker.displayName} used ${ability.displayName} for ${damage} damage.`, ...notes].join('\n')
  };
}
