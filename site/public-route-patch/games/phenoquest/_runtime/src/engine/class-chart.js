export const CLASS_ADVANTAGES = {
  fruit: ['skunk'],
  skunk: ['haze'],
  haze: ['kush'],
  kush: ['gas'],
  gas: ['frost'],
  frost: ['fruit']
};

export function getClassMultiplier(attackerClasses = [], defenderClasses = []) {
  let multiplier = 1;

  for (const attackerClass of attackerClasses) {
    const strongAgainst = CLASS_ADVANTAGES[attackerClass] ?? [];
    for (const defenderClass of defenderClasses) {
      if (strongAgainst.includes(defenderClass)) {
        multiplier += 0.25;
      }
    }
  }

  return multiplier;
}

export function describeClassMatchup(attackerClasses = [], defenderClasses = []) {
  const multiplier = getClassMultiplier(attackerClasses, defenderClasses);
  if (multiplier > 1) return 'Advantage';
  return 'Neutral';
}
