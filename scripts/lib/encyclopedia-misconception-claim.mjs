/** Extract the claim challenged by Q2, excluding an optional explanatory correction. */
export function misconceptionClaim(value) {
  if (value && typeof value === 'object') {
    return String(value.claim ?? value.misconception ?? '').trim();
  }
  const text = String(value ?? '').trim();
  // String entries encode either "claim: correction" or "Claim. Explanation".
  // Select the earliest recognizable boundary without copying the correction into Q2.
  const colon = text.search(/:\s+/u);
  const sentence = text.search(/[.!?](?=\s|$)/u);
  const end = colon >= 0 && (sentence < 0 || colon < sentence) ? colon : (sentence >= 0 ? sentence + 1 : text.length);
  return text.slice(0, end).trim();
}
