import https from 'node:https';

const nativeFetch = globalThis.fetch.bind(globalThis);
const targetHost = 'dtfseeds.com';

function toHeaders(input) {
  const headers = new Headers(input || {});
  return Object.fromEntries(headers.entries());
}

function responseHeaders(raw) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw || {})) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value != null) {
      headers.set(key, String(value));
    }
  }
  return headers;
}

function requestWithIpv4(url, init = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const method = String(init.method || 'GET').toUpperCase();
    const body = init.body == null ? null : String(init.body);
    const request = https.request(parsed, {
      method,
      family: 4,
      servername: parsed.hostname,
      headers: toHeaders(init.headers),
      signal: init.signal
    }, (res) => {
      const status = Number(res.statusCode || 0);
      const location = res.headers.location;
      const shouldFollow = init.redirect !== 'manual'
        && [301, 302, 303, 307, 308].includes(status)
        && location
        && redirects < 3;

      if (shouldFollow) {
        res.resume();
        const nextUrl = new URL(location, parsed).toString();
        const nextInit = { ...init };
        if (status === 303 || ((status === 301 || status === 302) && method === 'POST')) {
          nextInit.method = 'GET';
          delete nextInit.body;
        }
        resolve(requestWithIpv4(nextUrl, nextInit, redirects + 1));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve(new Response(Buffer.concat(chunks), {
          status,
          statusText: res.statusMessage || '',
          headers: responseHeaders(res.headers)
        }));
      });
    });

    request.on('error', (error) => {
      console.warn(`[wordpress-ipv4] ${method} ${parsed.pathname}${parsed.search} failed: ${error?.code || error?.name || error?.message || error}`);
      reject(error);
    });

    if (body != null) request.write(body);
    request.end();
  });
}

globalThis.fetch = async function ipv4WordPressFetch(input, init = {}) {
  const url = typeof input === 'string' || input instanceof URL
    ? String(input)
    : String(input?.url || '');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return nativeFetch(input, init);
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== targetHost) {
    return nativeFetch(input, init);
  }

  return requestWithIpv4(parsed.toString(), init);
};
