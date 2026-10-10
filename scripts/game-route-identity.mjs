/** Verify that the High Land play URL serves the game, not a generic hub fallback. */
export function isHighLandPlayableDocument(html) {
  if (typeof html !== 'string') return false;
  const title = html.match(/<title\b[^>]*>([^<]*)<\/title\s*>/i)?.[1]?.trim() || '';
  return /^High Land\b/i.test(title) &&
    /(<script\b|<button\b|<canvas\b|<form\b|id=["']root["'])/i.test(html);
}
