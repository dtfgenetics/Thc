export function isRecoverableHighLifeState(saved, maxTurns) {
  if (!saved || !Number.isInteger(maxTurns) || maxTurns <= 0) return false;
  if (!Number.isInteger(saved.turn) || saved.turn < 0 || saved.turn > maxTurns) return false;
  if (!saved.resources || typeof saved.resources !== 'object') return false;

  if (saved.complete === true) {
    return saved.turn === maxTurns && Number.isFinite(saved.finalScore);
  }

  return saved.turn < maxTurns;
}
