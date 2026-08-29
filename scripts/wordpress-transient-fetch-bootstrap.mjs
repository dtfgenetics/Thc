import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const nativeFetch = globalThis.fetch.bind(globalThis);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const transientCodes = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
]);

function requestUrl(input) {
  if (typeof input === 'string' || input instanceof URL) return String(input);
  return String(input?.url || '');
}

function requestMethod(input, init = {}) {
  return String(init.method || input?.method || 'GET').toUpperCase();
}

function isKnownIdWrite(url, method) {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;
  try {
    const parsed = new URL(url);
    return /\/wp-json\/(?:wp\/v2|wc\/v3)\/.+\/\d+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function retryEligible(url, method) {
  if (!/^https:\/\/dtfseeds\.com\//i.test(url)) return false;
  return ['GET', 'HEAD'].includes(method) || isKnownIdWrite(url, method);
}

function errorCode(error) {
  return error?.code || error?.cause?.code || error?.cause?.errors?.find?.((entry) => entry?.code)?.code || '';
}

function isTransientError(error) {
  return error instanceof TypeError || error?.name === 'TimeoutError' || error?.name === 'AbortError' || transientCodes.has(errorCode(error));
}

function retryDelay(attempt) {
  return Math.min(7000, 900 * (2 ** (attempt - 1)));
}

globalThis.fetch = async function resilientWordPressFetch(input, init = {}) {
  const url = requestUrl(input);
  const method = requestMethod(input, init);
  const eligible = retryEligible(url, method);
  const maxAttempts = eligible ? 7 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await nativeFetch(input, {
        ...init,
        signal: AbortSignal.timeout(45_000)
      });
      if (!eligible || !transientStatuses.has(response.status) || attempt === maxAttempts) return response;
      try { await response.body?.cancel(); } catch {}
      console.warn(`[wordpress-retry] ${method} ${url} returned ${response.status}; retrying (${attempt}/${maxAttempts})`);
    } catch (error) {
      lastError = error;
      if (!eligible || !isTransientError(error) || attempt === maxAttempts) throw error;
      console.warn(`[wordpress-retry] ${method} ${url} failed with ${errorCode(error) || error?.name || 'network error'}; retrying (${attempt}/${maxAttempts})`);
    }
    await sleep(retryDelay(attempt));
  }

  throw lastError || new Error(`WordPress request failed after ${maxAttempts} attempts: ${method} ${url}`);
};
