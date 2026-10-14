// Reader-facing rendering only. Preserve the canonical citation and its
// fingerprint; strip presentation labels that have no corresponding link.
// Do not silently create an external destination or claim a citation is reviewed.
export function displaySourceNote(note) {
  const value = String(note ?? '').trim();
  if (!value) return '';
  // A historical import appended the words 'Open source' or 'Publisher record'
  // to some bibliography strings. Without a URL these are nonfunctional link
  // labels, not part of the scientific citation.
  return value.replace(/\\s{2,}(?:Open source|Publisher record)\\s*$/i, '').trim();
}
