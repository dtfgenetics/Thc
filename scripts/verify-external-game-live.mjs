import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractsDir = path.join(repoRoot, 'site', 'deployment', 'external-games');
const siteUrl = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const cacheTag = process.env.GITHUB_RUN_ID || `${Date.now()}`;
const promotableStatuses = new Set(['release-candidate', 'ready-to-package']);

function parseRevision(raw, label) {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) throw new Error(`${label}: malformed source revision line ${JSON.stringify(line)}`);
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

async function fetchExact(url, { json = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-External-Game-Live-Verify/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`redirected (${response.status}) to ${response.headers.get('location') || '(unknown)'}`);
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      return json ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw new Error(`${url}: ${lastError?.message || lastError}`);
}

function localRuntimeRefs(html) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const value = match[1].trim();
    if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('mailto:') || value.startsWith('tel:')) continue;
    if (/^(?:https?:)?\/\//i.test(value)) continue;
    const clean = value.split('#', 1)[0].split('?', 1)[0];
    if (!clean || clean === './' || clean === '../') continue;
    if (/\.(?:js|mjs|css|json)$/i.test(clean)) refs.add(clean);
  }
  return [...refs];
}

const names = (await readdir(contractsDir)).filter(name => name.endsWith('.json')).sort();
const checked = [];
for (const name of names) {
  const contract = JSON.parse(await readFile(path.join(contractsDir, name), 'utf8'));
  if (!promotableStatuses.has(contract.status)) continue;

  const route = String(contract.route || '');
  const target = route.replace(/^\/+|\/+$/g, '');
  const revisionPath = path.join(repoRoot, 'site', 'public-route-patch', target, 'source-revision.txt');
  const revision = parseRevision(await readFile(revisionPath, 'utf8'), name);
  const expectedCommit = String(contract.verifiedRevision || revision.commit || '');
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) throw new Error(`${name}: invalid expected commit ${expectedCommit}`);
  if (revision.commit !== expectedCommit) throw new Error(`${name}: contract/revision commit mismatch`);
  if (revision.repository !== contract.repository) throw new Error(`${name}: contract/revision repository mismatch`);
  if (revision.route !== route) throw new Error(`${name}: contract/revision route mismatch`);

  const routeUrl = `${siteUrl}${route}`;
  const suffix = `dtf_external_verify=${encodeURIComponent(cacheTag)}-${encodeURIComponent(contract.id)}`;
  const html = await fetchExact(`${routeUrl}?${suffix}`);
  if (!/<(?:!doctype|html)\b/i.test(html)) throw new Error(`${name}: live route is not HTML`);

  const liveRelease = await fetchExact(`${routeUrl}game-release.json?${suffix}`, { json: true });
  if (liveRelease.id !== contract.id) throw new Error(`${name}: live release id ${liveRelease.id} != ${contract.id}`);
  if (liveRelease.route !== route) throw new Error(`${name}: live release route ${liveRelease.route} != ${route}`);

  const liveRevisionRaw = await fetchExact(`${routeUrl}source-revision.txt?${suffix}`);
  const liveRevision = parseRevision(liveRevisionRaw, `${name} live source revision`);
  if (liveRevision.commit !== expectedCommit) {
    throw new Error(`${name}: live commit ${liveRevision.commit || '(missing)'} != ${expectedCommit}`);
  }
  if (liveRevision.repository !== contract.repository || liveRevision.route !== route) {
    throw new Error(`${name}: live source identity mismatch`);
  }

  const base = new URL(routeUrl);
  const assets = localRuntimeRefs(html);
  for (const ref of assets) {
    const assetUrl = new URL(ref, base);
    assetUrl.searchParams.set('dtf_external_verify', `${cacheTag}-${contract.id}`);
    await fetchExact(assetUrl.href);
  }

  checked.push({
    id: contract.id,
    route,
    commit: expectedCommit,
    runtimeAssets: assets.length,
  });
  console.log(`Live external game verified: ${contract.id} ${route} @ ${expectedCommit} (${assets.length} local runtime assets).`);
}

if (!checked.length) throw new Error('No promotable external games were found for live verification.');
console.log(JSON.stringify({ ok: true, site: siteUrl, checked }, null, 2));
