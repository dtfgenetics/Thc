/** Extract the claim challenged by Q2, without explanatory corrections. */
export function misconceptionClaim(value) {
  const raw = value && typeof value === 'object'
    ? String(value.claim ?? value.misconception ?? '').trim()
    : String(value ?? '').trim();
  // Canonical material may encode "claim: correction" or "Claim. Explanation".
  // Isolate the same first sentence for generated and stored assessments.
  const withoutCorrection = raw.split(/:\s+/u, 1)[0].trim();
  return (withoutCorrection.match(/^.*?[.!?](?:\s|$)/u)?.[0] ?? withoutCorrection).trim();
}
