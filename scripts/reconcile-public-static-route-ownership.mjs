import crypto from 'node:crypto';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const projectsFingerprint = 'dtf-release-fingerprint: projects-public-games-25-v3';
const staleProjectsFingerprint = 'Projects is the roadmap for DTF Genetics.';
let mcpSession = '';
let projectPageBackup = null;
let projectPageChanged = false;

async function wpRequest(path, { method = 'GET', json, allow = [] } = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
  }
  return { ok: response.ok, status: response.status, body };
}

function parseRpcText(text) {
  try { return JSON.parse(text); } catch {}
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try { return JSON.parse(line.slice(5).trim()); } catch {}
  }
  return null;
}

async function mcpRpc(payload) {
  const headers = {
    Authorization: auth,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
  if (mcpSession) headers['Mcp-Session-Id'] = mcpSession;
  const response = await fetch(`${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const next = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id');
  if (next) mcpSession = next;
  const text = await response.text();
  const body = parseRpcText(text);
  if (!response.ok || !body || body.error) {
    throw new Error(`Hostinger MCP failed (${response.status}): ${JSON.stringify(body?.error || body || text.slice(0, 350))}`);
  }
  return body;
}

async function initMcp() {
  let lastError;
  for (const protocolVersion of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    try {
      await mcpRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'DTFRouteOwnership', version: '1.0.0' } },
      });
      try { await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }); } catch {}
      return;
    } catch (error) {
      lastError = error;
      mcpSession = '';
    }
  }
  throw lastError || new Error('Unable to initialize Hostinger MCP.');
}

async function purgeHostingerCache() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      mcpSession = '';
      await initMcp();
      const result = await mcpRpc({
        jsonrpc: '2.0',
        id: crypto.randomInt(1000, 9_000_000),
        method: 'tools/call',
        params: { name: 'hostinger-ai-assistant-litespeed-cache-flush', arguments: {} },
      });
      if (result?.result?.isError === true) throw new Error('LiteSpeed tool returned isError.');
      console.log('Hostinger LiteSpeed cache purge succeeded.');
      return;
    } catch (error) {
      lastError = error;
      await sleep(1500 * attempt);
    }
  }
  throw new Error(`Hostinger LiteSpeed cache purge failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function probe(path, { cacheBust = false } = {}) {
  const url = new URL(path, siteUrl);
  if (cacheBust) url.searchParams.set('dtf_route_ownership', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'DTFSeeds-Route-Ownership/1.0',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  return { response, text };
}

function assertDirectHtml(label, { response, text }, required, forbidden = []) {
  const location = response.headers.get('location') || '';
  if (response.status !== 200 || location) {
    throw new Error(`${label} is not direct HTTP 200 (HTTP ${response.status}${location ? ` -> ${location}` : ''}).`);
  }
  for (const marker of required) {
    if (!text.includes(marker)) throw new Error(`${label} is missing required marker: ${marker}`);
  }
  for (const marker of forbidden) {
    if (text.includes(marker)) throw new Error(`${label} still exposes stale marker: ${marker}`);
  }
}

async function verifyStaticProjectsIndex() {
  const result = await probe('/projects/index.html', { cacheBust: true });
  assertDirectHtml('Projects static index', result, [
    projectsFingerprint,
    'This roadmap follows the same release records used by DTFSeeds deployment.',
    'Bud or Bluff',
    'Strain Showdown',
    'Terpocalypse: Grow Room From Hell',
    'PhenoQuest: The Living Seed Vault',
    'High Lines',
    'Pheno Draft',
  ], [staleProjectsFingerprint]);
}

async function findProjectsPage() {
  const params = new URLSearchParams({ slug: 'projects', context: 'edit', per_page: '100' });
  const result = await wpRequest(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(result.body)) throw new Error('Unexpected WordPress projects page lookup response.');
  if (result.body.length > 1) throw new Error(`Refusing ambiguous Projects ownership: found ${result.body.length} WordPress pages with slug projects.`);
  return result.body[0] || null;
}

async function retireConflictingProjectsPage() {
  const page = await findProjectsPage();
  if (!page) {
    console.log('No WordPress page with slug projects exists; static route has no page-owner conflict.');
    return { found: false, changed: false, pageId: null, priorStatus: null };
  }

  const priorStatus = String(page.status || '');
  projectPageBackup = { id: Number(page.id), status: priorStatus };
  if (!projectPageBackup.id) throw new Error('WordPress Projects page did not expose a valid page ID.');

  if (priorStatus !== 'publish') {
    console.log(`WordPress Projects page ${projectPageBackup.id} is already non-public (${priorStatus || 'unknown'}).`);
    return { found: true, changed: false, pageId: projectPageBackup.id, priorStatus };
  }

  const updated = await wpRequest(`/wp-json/wp/v2/pages/${projectPageBackup.id}`, {
    method: 'POST',
    json: { status: 'draft' },
  });
  if (updated.body?.status !== 'draft') throw new Error('WordPress did not confirm the conflicting Projects page as draft.');
  projectPageChanged = true;
  console.log(`Retired conflicting WordPress /projects/ page ${projectPageBackup.id}; static release route is canonical.`);
  return { found: true, changed: true, pageId: projectPageBackup.id, priorStatus };
}

async function restoreProjectsPageBestEffort() {
  if (!projectPageChanged || !projectPageBackup?.id || !projectPageBackup.status) return;
  try {
    await wpRequest(`/wp-json/wp/v2/pages/${projectPageBackup.id}`, {
      method: 'POST',
      json: { status: projectPageBackup.status },
    });
    projectPageChanged = false;
    await purgeHostingerCache();
    console.error(`Restored WordPress Projects page ${projectPageBackup.id} to ${projectPageBackup.status} after failed static-route verification.`);
  } catch (error) {
    console.error(`CRITICAL: could not restore WordPress Projects page ${projectPageBackup.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyOrdinaryPublicRoutes() {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const projects = await probe('/projects/');
      assertDirectHtml('Projects public route', projects, [
        projectsFingerprint,
        'This roadmap follows the same release records used by DTFSeeds deployment.',
      ], [staleProjectsFingerprint]);

      const bud = await probe('/games/bud-or-bluff/');
      assertDirectHtml('Bud or Bluff public route', bud, ['Bud or Bluff', 'Create lobby'], ['DTF Game Hub | Original Cannabis Browser Games']);

      const retired = await probe('/games/future-slots/');
      const location = retired.response.headers.get('location') || '';
      if (![301, 302].includes(retired.response.status) || !location.includes('/games/')) {
        throw new Error(`future-slots retirement route is invalid (HTTP ${retired.response.status}${location ? ` -> ${location}` : ''}).`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 6) {
        await purgeHostingerCache();
        await sleep(1800 + attempt * 900);
      }
    }
  }
  throw lastError || new Error('Ordinary public-route verification failed.');
}

try {
  // Never retire a WordPress route owner unless the newly deployed static file is
  // already present and carries the exact source-controlled release fingerprint.
  await verifyStaticProjectsIndex();
  const ownership = await retireConflictingProjectsPage();
  await purgeHostingerCache();
  await verifyOrdinaryPublicRoutes();
  console.log(JSON.stringify({
    ok: true,
    projectsOwnership: ownership,
    projectsFingerprint,
    ordinaryProjectsDirect: true,
    ordinaryBudOrBluffDirect: true,
    futureSlotsRetired: true,
  }));
} catch (error) {
  await restoreProjectsPageBestEffort();
  throw error;
}
