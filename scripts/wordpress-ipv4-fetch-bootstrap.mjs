import https from 'node:https';

const nativeFetch = globalThis.fetch.bind(globalThis);
const targetHost = 'dtfseeds.com';
const requireCacheConvergence = String(process.env.DTF_REQUIRE_CACHE_CONVERGENCE || '').toLowerCase() === 'true';
let wordpressMutationPending = false;
let cacheFlushPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function parseMcpBody(text) {
  try {
    return JSON.parse(text);
  } catch {}

  const dataLines = String(text || '')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (const line of dataLines) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  return { raw: String(text || '').slice(0, 1600) };
}

async function flushLiteSpeedCacheRequired() {
  if (!requireCacheConvergence) return false;
  if (cacheFlushPromise) return cacheFlushPromise;

  cacheFlushPromise = (async () => {
    const username = process.env.WP_API_USERNAME || '';
    const password = process.env.WP_API_PASSWORD || '';
    if (!username || !password) {
      throw new Error('DTF cache convergence requires WP_API_USERNAME and WP_API_PASSWORD');
    }

    const endpoint = `https://${targetHost}/wp-json/hostinger-ai-assistant/v1/mcp`;
    const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const versions = ['2025-06-18', '2025-03-26', '2024-11-05'];
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const protocolVersion of versions) {
        let sessionId = '';
        const rpc = async (payload) => {
          const headers = {
            Authorization: auth,
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          };
          if (sessionId) headers['Mcp-Session-Id'] = sessionId;

          const response = await requestWithIpv4(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            redirect: 'follow',
            signal: AbortSignal.timeout(45_000)
          });
          const nextSession = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
          if (nextSession) sessionId = nextSession;
          const body = parseMcpBody(await response.text());
          if (!response.ok || body?.error) {
            throw new Error(`Hostinger MCP request failed (${response.status}): ${JSON.stringify(body?.error || body).slice(0, 700)}`);
          }
          return body;
        };

        try {
          await rpc({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion,
              capabilities: {},
              clientInfo: { name: 'DTFLearningCacheConvergence', version: '1.0.0' }
            }
          });
          try {
            await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
          } catch {}
          const result = await rpc({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} }
          });
          if (result?.result?.isError === true) throw new Error('Hostinger LiteSpeed cache tool reported an error');
          console.log(`[wordpress-ipv4] LiteSpeed cache purged after WordPress mutation (protocol ${protocolVersion}, attempt ${attempt}).`);
          return true;
        } catch (error) {
          lastError = error;
          console.warn(`[wordpress-ipv4] Cache purge attempt ${attempt} with MCP ${protocolVersion} failed: ${error?.message || error}`);
        }
      }
      if (attempt < 3) await sleep(attempt * 2500);
    }

    throw new Error(`LiteSpeed cache purge required after WordPress mutation failed: ${lastError?.message || lastError || 'unknown error'}`);
  })();

  try {
    return await cacheFlushPromise;
  } finally {
    cacheFlushPromise = null;
  }
}

function isWordPressMutation(parsed, method) {
  return requireCacheConvergence
    && parsed.hostname.toLowerCase() === targetHost
    && parsed.pathname.startsWith('/wp-json/wp/v2/')
    && !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function isPublicVisitorRequest(parsed, method) {
  return requireCacheConvergence
    && parsed.hostname.toLowerCase() === targetHost
    && !parsed.pathname.startsWith('/wp-json/')
    && ['GET', 'HEAD'].includes(method);
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

  const method = String(init.method || input?.method || 'GET').toUpperCase();
  if (wordpressMutationPending && isPublicVisitorRequest(parsed, method)) {
    await flushLiteSpeedCacheRequired();
    wordpressMutationPending = false;
  }

  const response = await requestWithIpv4(parsed.toString(), init);
  if (response.ok && isWordPressMutation(parsed, method)) {
    wordpressMutationPending = true;
  }
  return response;
};
