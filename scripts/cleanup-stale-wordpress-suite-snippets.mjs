import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const currentRunId = String(process.env.GITHUB_RUN_ID || '').trim();
const prefix = 'DTF Public Suite Deploy V2 ';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', allow = [] } = {}) {
  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Stale-Suite-Bridge-Cleanup/1.0'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000)
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status >= 500 || response.status === 429) && attempt < 5) {
        await sleep(attempt * 1800);
        continue;
      }
      if (!response.ok && !allow.includes(response.status)) {
        throw new Error(`${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      last = error;
      if (attempt < 5) await sleep(attempt * 1800);
    }
  }
  throw last || new Error(`${method} ${path} failed.`);
}

function normalizeCollection(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['snippets', 'data', 'items', 'results']) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

async function listSnippets(safeMode = false) {
  const suffix = safeMode ? 'snippets-safe-mode=1&' : '';
  const result = await request(`/wp-json/code-snippets/v1/snippets?${suffix}per_page=100`, { allow: [400, 403, 404, 500] });
  if (!result.ok) return { available: false, safeMode, status: result.status, snippets: [] };
  return { available: true, safeMode, status: result.status, snippets: normalizeCollection(result.body) };
}

let listing = await listSnippets(false);
if (!listing.available) listing = await listSnippets(true);
if (!listing.available) {
  throw new Error(`Code Snippets REST listing is unavailable in normal and safe mode; last status=${listing.status}. Refusing production publication while stale bridge state is unknown.`);
}

const stale = listing.snippets.filter((snippet) => {
  const name = String(snippet?.name || '');
  if (!name.startsWith(prefix)) return false;
  if (currentRunId && name === `${prefix}${currentRunId}`) return false;
  return true;
});

const removed = [];
const suffix = listing.safeMode ? '?snippets-safe-mode=1' : '';
for (const snippet of stale) {
  const id = Number(snippet?.id || 0);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Stale deployment snippet has no valid numeric ID: ${JSON.stringify({ name: snippet?.name ?? null, id: snippet?.id ?? null })}`);
  await request(`/wp-json/code-snippets/v1/snippets/${id}/deactivate${suffix}`, { method: 'POST', allow: [400, 404, 500] });
  await request(`/wp-json/code-snippets/v1/snippets/${id}${suffix}`, { method: 'DELETE', allow: [404, 500] });
  removed.push({ id, name: String(snippet?.name || '') });
  console.log(`Removed stale temporary Public Suite bridge snippet id=${id}.`);
}

if (removed.length) await sleep(1800);
let after = await listSnippets(false);
if (!after.available) after = await listSnippets(true);
if (!after.available) throw new Error('Unable to verify stale deployment snippet cleanup.');
const remaining = after.snippets.filter((snippet) => String(snippet?.name || '').startsWith(prefix));
if (remaining.length) {
  throw new Error(`Stale Public Suite bridge snippets remain after cleanup: ${JSON.stringify(remaining.map((snippet) => ({ id: snippet?.id ?? null, name: snippet?.name ?? null })))}`);
}

console.log(JSON.stringify({
  ok: true,
  checkedMode: listing.safeMode ? 'safe-mode' : 'normal',
  candidates: stale.length,
  removed,
  remaining: 0
}));
