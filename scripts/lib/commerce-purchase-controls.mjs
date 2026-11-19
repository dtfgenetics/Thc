// Public HTML markup guard only; does not prove server-side WooCommerce blocking.
// Scan tokens without rewriting HTML via multiple sanitization passes.
export function hasPublicPurchaseControl(html = '') {
  const tokens = html.match(/<!--[\s\S]*?-->|<\/?(?:script|style|template)\b[^>]*>|<(?:a|button|input|form)\b[^>]*>/gi) || [];
  let ignored = null;

  for (const tag of tokens) {
    if (tag.startsWith('<!--')) continue;
    const openIgnored = /^<(script|style|template)\b/i.exec(tag);
    if (openIgnored) {
      if (ignored === null) ignored = openIgnored[1].toLowerCase();
      continue;
    }
    const closeIgnored = /^<\/(script|style|template)\b/i.exec(tag);
    if (closeIgnored) {
      if (ignored === closeIgnored[1].toLowerCase()) ignored = null;
      continue;
    }
    if (ignored !== null) continue;

    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((m) => [m[1].toLowerCase(), (m[2] ?? m[3] ?? m[4] ?? '').toLowerCase()])
    );
    const href = (attrs.href || '').replaceAll('&amp;', '&');
    const name = attrs.name || '';
    const className = attrs.class || '';
    const action = (attrs.action || '').replaceAll('&amp;', '&');
    // aria-disabled does not prevent link navigation. Native disabled only
    // prevents activation on supporting elements such as input and button.
    const nativeDisabled = /^<(?:button|input)\b/i.test(tag) && /\sdisabled(?:\s|=|>)/i.test(tag);
    if (nativeDisabled) continue;
    if (name === 'add-to-cart' ||
      /(?:^|[?&])add-to-cart(?:=|&|$)/i.test(href) ||
      /\b(?:add_to_cart_button|single_add_to_cart_button|ajax_add_to_cart)\b/.test(className) ||
      /(?:^|[?&])add-to-cart(?:=|&|$)/i.test(action) ||
      (/^<form\b/i.test(tag) && /\bcart\b/.test(className))) {
      return true;
    }
  }
  return false;
}
