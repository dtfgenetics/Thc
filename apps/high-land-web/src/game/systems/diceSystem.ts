export function rollDie(random: () => number = Math.random): number {
  return Math.floor(random() * 6) + 1;
}

export function isValidDieRoll(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}
