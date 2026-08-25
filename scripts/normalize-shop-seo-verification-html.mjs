export function decodeHtmlEntities(value = '') {
  const named = new Map([
    ['amp', '&'],
    ['quot', '"'],
    ['apos', "'"],
    ['lt', '<'],
    ['gt', '>'],
    ['nbsp', ' '],
  ]);
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named.has(name.toLowerCase()) ? named.get(name.toLowerCase()) : match);
}

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
  if (!url.includes('/shop/?dtf_shop_seo=')) return response;

  const raw = await response.text();
  const normalized = decodeHtmlEntities(raw);
  return new Response(normalized, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
