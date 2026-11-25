/** A public route must finish on the intended site, not an arbitrary redirect. */
export function isOnSiteFinalDocument(requestedUrl, finalUrl, canonicalOrigin) {
  try {
    const requested = new URL(requestedUrl);
    const final = new URL(finalUrl);
    const origin = new URL(canonicalOrigin).origin;
    return requested.origin === origin &&
      final.origin === origin &&
      final.protocol === 'https:' &&
      !final.username && !final.password;
  } catch {
    return false;
  }
}
