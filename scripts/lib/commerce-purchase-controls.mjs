// Public markup guard only. It cannot prove WordPress server-side purchase blocking.
export function hasPublicPurchaseControl(html = '') {
  const rendered = html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[^]*?<\/\1\s*>/gi, '');
  const tags = rendered.match(/<(?:a|button|input|form)\b[^>]*>/gi) || [];
  return tags.some((tag) => {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((m) => [m[1].toLowerCase(), (m[2] ?? m[3] ?? m[4] ?? '').toLowerCase()])
    );
    const href = (attrs.href || '').replaceAll('&amp;', '&');
    const name = attrs.name || '';
    const className = attrs.class || '';
    const action = (attrs.action || '').replaceAll('&amp;', '&');
    // aria-disabled is advisory on links; an href still navigates and may add an item.
    // Native disabled only prevents activation on controls that support the attribute.
    const nativeDisabled = /^<(?:button|input)\b/i.test(tag) && /\sdisabled(?:\s|=|>)/i.test(tag);
    if (nativeDisabled) return false;
    return name === 'add-to-cart' ||
      /(?:^|[?&])add-to-cart(?:=|&|$)/i.test(href) ||
      /\b(?:add_to_cart_button|single_add_to_cart_button|ajax_add_to_cart)\b/.test(className) ||
      /(?:^|[?&])add-to-cart(?:=|&|$)/i.test(action) ||
      /\bclass\s*=\s*["'][^"']*\bcart\b/i.test(tag) && /^<form\b/i.test(tag);
  });
}
