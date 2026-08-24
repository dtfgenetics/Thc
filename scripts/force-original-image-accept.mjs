const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || String(input);
}

globalThis.fetch = async function fetchOriginalImageRepresentation(input, init = {}) {
  const url = requestUrl(input);
  const baseHeaders = init.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
  const headers = new Headers(baseHeaders || {});
  const accept = headers.get('accept') || '';

  // Shopify and WordPress can negotiate AVIF/WebP when the client advertises them.
  // Genetics identity verification pins the original reviewed JPEG/PNG bytes, so
  // image reads must request the original representation rather than a transformed
  // derivative. JSON/API requests and uploads are left untouched.
  if (
    /image\/(?:avif|webp|apng)/i.test(accept) &&
    (url.includes('cdn.shopify.com/') || url.includes('/wp-content/uploads/'))
  ) {
    headers.set('Accept', 'image/*');
  }

  return nativeFetch(input, { ...init, headers });
};
