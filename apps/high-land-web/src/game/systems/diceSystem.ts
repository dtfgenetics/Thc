export function rollDie(random: () => number = Math.random): number {
  const value = Math.max(0, Math.min(0.999999, random()));
  return Math.floor(value * 6) + 1;
}

export function isValidDieRoll(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}
