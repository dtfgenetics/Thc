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
    let skipDataPayload = false;
    for (const candidate of value.split(',')) {
      const trimmed = candidate.trim();
      if (skipDataPayload) {
        // The comma separates a data URL's metadata and payload, not
        // two independently fetchable image candidates.
        skipDataPayload = false;
        continue;
      }
      if (/^data:/i.test(trimmed)) {
        skipDataPayload = true;
        continue;
      }
      const url = trimmed.split(/\s+/)[0];
      if (url) add(url);
    }
  };
  // Consume non-rendered blocks as one token so markup embedded in JS,
  // comments, styles or templates is never mistaken for a browser request.
  // External <script src> still counts as a real asset.
  const tokens = /<!--[\s\S]*?-->|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:img|script|source|link)\b[^>]*>/gi;
  for (const token of html.matchAll(tokens)) {
    const full = token[0];
    if (full.startsWith('<!--')) continue;
    if (/^<(?:style|template)\b/i.test(full)) continue;
    const tag = /^<script\b/i.test(full)
      ? (full.match(/^<script\b[^>]*>/i)?.[0] || '')
      : full;
    if (/^<(?:img|script|source)\b/i.test(tag)) {
      add(attr(tag, 'src'));
      if (/^<(?:img|source)\b/i.test(tag)) {
        srcset(attr(tag, 'srcset'));
        srcset(attr(tag, 'data-srcset'));
        add(attr(tag, 'data-src'));
      }
      continue;
    }
    if (!/^<link\b/i.test(tag)) continue;
    const rel = attr(tag, 'rel').toLowerCase();
    if (/(?:^|\s)(?:stylesheet|icon|preload|modulepreload)(?:\s|$)/.test(rel)) {
      add(attr(tag, 'href'));
      if (/\bimage\b/.test(attr(tag, 'as'))) srcset(attr(tag, 'imagesrcset'));
    }
  }
  return [...assets].slice(0, 100);
}
