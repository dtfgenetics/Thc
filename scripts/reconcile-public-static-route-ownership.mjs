import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

dns.setDefaultResultOrder('ipv4first');

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WordPress credentials are required.');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const canonicalProjectsIndex = fs.readFileSync('site/public-route-patch/projects/index.html', 'utf8');
const projectsFingerprint = canonicalProjectsIndex.match(/dtf-release-fingerprint: [A-Za-z0-9._:-]+/)?.[0] || '';
if (!projectsFingerprint) throw new Error('Canonical Projects index does not expose a release fingerprint.');

const staleProjectsFingerprint = 'Projects is the roadmap for DTF Genetics.';
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
let projectPageBackup = null;
let projectPageChanged = false;

function collectErrorCodes(error, target = new Set()) {
  if (!error || typeof error !== 'object') return target;
  if (typeof error.code === 'string') target.add(error.code);
  if (error.cause && error.cause !== error) collectErrorCodes(error.cause, target);
  if (Array.isArray(error.errors)) for (const nested of error.errors) collectErrorCodes(nested, target);
  return target;
}

function isTransient(error) {
  if (!error || typeof error !== 'object') return false;
  if (Number.isInteger(error.status) && transientStatuses.has(error.status)) return true;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return [...collectErrorCodes(error)].some((code) => ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'].includes(code));
}

async function wpRequest(path, { method = 'GET', json, allow = [] } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        method,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok && !allow.includes(response.status)) {
        const error = new Error(`WordPress ${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 700) : JSON.stringify(body).slice(0, 700)}`);
        error.status = response.status;
        if (!transientStatuses.has(response.status)) throw error;
        lastError = error;
      } else {
        return { ok: response.ok, status: response.status, body };
      }
    } catch (error) {
      if (!isTransient(error)) throw error;
      lastError = error;
    }
    if (attempt < 8) {
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 10_000));
    }
  }
  throw lastError || new Error(`WordPress ${method} ${path} failed after retries.`);
}

async function probe(path, { cacheBust = false } = {}) {
  const url = new URL(path, siteUrl);
  if (cacheBust) url.searchParams.set('dtf_route_ownership', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'DTFSeeds-Route-Ownership/1.1',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
        },
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      return { response, text };
    } catch (error) {
      if (!isTransient(error)) throw error;
      lastError = error;
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 10_000));
    }
  }
  throw lastError || new Error(`Visitor probe failed for ${path}`);
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
    'Terpocalypse',
    'PhenoQuest',
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

async function runCachePurgeBestEffort() {
  const env = {
    ...process.env,
    LITESPEED_PURGE_URLS: '/projects/,/projects/index.html,/games/bud-or-bluff/,/games/seed-man-platformer/',
  };
  let lastCode = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    lastCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['scripts/purge-wordpress-litespeed-cache.mjs'], { env, stdio: 'inherit' });
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });
    if (lastCode === 0) return true;
    await sleep(attempt * 8000);
  }
  console.warn(`Cache purge helper did not complete after retries (exit ${lastCode}); continuing to direct visitor verification.`);
  return false;
}

async function restoreProjectsPageBestEffort() {
  if (!projectPageChanged || !projectPageBackup?.id || !projectPageBackup.status) return;
  try {
    await wpRequest(`/wp-json/wp/v2/pages/${projectPageBackup.id}`, {
      method: 'POST',
      json: { status: projectPageBackup.status },
    });
    projectPageChanged = false;
    await runCachePurgeBestEffort();
    console.error(`Restored WordPress Projects page ${projectPageBackup.id} to ${projectPageBackup.status} after failed static-route verification.`);
  } catch (error) {
    console.error(`CRITICAL: could not restore WordPress Projects page ${projectPageBackup.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyOrdinaryPublicRoutes() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
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
      if (attempt < 8) {
        await runCachePurgeBestEffort();
        await sleep(2500 + attempt * 1000);
      }
    }
  }
  throw lastError || new Error('Ordinary public-route verification failed.');
}

try {
  await verifyStaticProjectsIndex();
  const ownership = await retireConflictingProjectsPage();
  const purgeCompleted = await runCachePurgeBestEffort();
  await verifyOrdinaryPublicRoutes();
  console.log(JSON.stringify({
    ok: true,
    projectsOwnership: ownership,
    projectsFingerprint,
    cachePurgeCompleted: purgeCompleted,
    ordinaryProjectsDirect: true,
    ordinaryBudOrBluffDirect: true,
    futureSlotsRetired: true,
  }));
} catch (error) {
  await restoreProjectsPageBestEffort();
  throw error;
}
