// Retry only idempotent GET/HEAD requests around the transactional shadow repair.
// Mutating POST/DELETE requests are intentionally never retried here because a
// dropped response does not prove the server failed to apply the mutation.
const nativeFetch = globalThis.fetch.bind(globalThis);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function methodOf(init = {}) {
  return String(init?.method || 'GET').toUpperCase();
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

globalThis.fetch = async function resilientFetch(input, init = {}) {
  const method = methodOf(init);
  if (method !== 'GET' && method !== 'HEAD') {
    return nativeFetch(input, init);
  }

  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await nativeFetch(input, init);
      if (!isRetryableStatus(response.status) || attempt === 6) return response;
      try { await response.body?.cancel(); } catch {}
      lastError = new Error(`Retryable HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === 6) throw error;
    }
    await sleep(Math.min(15000, 1500 * attempt * attempt));
  }
  throw lastError || new Error('GET retry loop exited unexpectedly.');
};

await import('./repair-static-shadows-via-wordpress.mjs');
