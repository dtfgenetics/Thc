// Shared asset extraction used by the deterministic public-route health audit.
// Include browser-selected srcset candidates, not only fallback img src.
export function firstPartyAssets(html, route, baseOrigin) {
  const assets = new Set();
  const add = (raw) => {
    if (!raw || /^(?:data:|blob:|javascript:|mailto:|tel:)/i.test(raw)) return;
    try {
      const url = new URL(raw, route);
      if (url.origin !== baseOrigin) return;
      url.hash = '';
      assets.add(url.toString());
    } catch {}
  };
  const attr = (tag, name) => {
    const match = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\\x27])([^"\\x27]*)\\1', 'i'));
    return match?.[2] ?? '';
  };
  const srcset = value => {
    // The common URL + density/width descriptor syntax; data: candidates are
    // intentionally excluded because they do not require HTTP requests.
    for (const candidate of value.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) add(url);
    }
  };
  for (const tag of html.matchAll(/<(?:img|script|source)\b[^>]*>/gi)) {
    add(attr(tag[0], 'src'));
    if (/^<(?:img|source)\b/i.test(tag[0])) {
      srcset(attr(tag[0], 'srcset'));
      srcset(attr(tag[0], 'data-srcset'));
      add(attr(tag[0], 'data-src'));
    }
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attr(tag, 'rel').toLowerCase();
    if (/(?:^|\s)(?:stylesheet|icon|preload|modulepreload)(?:\s|$)/.test(rel)) {
      add(attr(tag, 'href'));
      if (/\bimage\b/.test(attr(tag, 'as'))) srcset(attr(tag, 'imagesrcset'));
    }
  }
  return [...assets].slice(0, 100);
}
