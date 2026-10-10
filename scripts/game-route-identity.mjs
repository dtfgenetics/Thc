/** Fail closed when the High Land play route serves a generic hub or static shell. */
export function isHighLandPlayableDocument(html) {
  if (typeof html !== 'string') return false;
  const title = html.match(/<title\b[^>]*>([^<]*)<\/title\s*>/i)?.[1]?.trim() || '';
  // High Land is a React/Vite app; a generic site script or JSON-LD alone
  // cannot prove that its application bundle was delivered.
  const hasAppMount = /<div\b[^>]*\bid=["']root["'][^>]*>/i.test(html);
  const hasAppBundle = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+\.m?js(?:[?#][^"']*)?["'])[^>]*>/i.test(html);
  return /^High Land\b/i.test(title) && hasAppMount && hasAppBundle;
}
