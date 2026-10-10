/** Extract the misconception claim without including a colon-delimited correction. */
export function misconceptionClaim(value) {
  if (value && typeof value === 'object') {
    return String(value.claim ?? value.misconception ?? '').trim();
  }
  return String(value ?? '').split(/:\s+/u, 1)[0].trim();
}
