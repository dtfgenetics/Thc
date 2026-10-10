/** Extract the claim challenged by Q2, excluding an optional explanatory correction. */
export function misconceptionClaim(value) {
  if (value && typeof value === 'object') {
    return String(value.claim ?? value.misconception ?? '').trim();
  }
  const text = String(value ?? '').trim();
  // Canonical string entries encode "claim: correction".
  return text.split(/:\s+/u, 1)[0].trim();
}
