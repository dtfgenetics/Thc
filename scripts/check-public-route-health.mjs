import fs from 'node:fs/promises';
import path from 'node:path';
import {
  WEB_QA_ARTIFACT_DIR,
  WEB_QA_BASE_URL,
  WEB_QA_ENFORCE,
  WEB_QA_ROUTE_FILE,
} from '../web-qa.config.mjs';

const routeFile = process.env.WEB_QA_ROUTE_FILE || WEB_QA_ROUTE_FILE;
const artifactDir = process.env.WEB_QA_ARTIFACT_DIR || WEB_QA_ARTIFACT_DIR;
const enforce = process.env.WEB_QA_ENFORCE === '1' || WEB_QA_ENFORCE;
const baseOrigin = new URL(process.env.WEB_QA_BASE_URL || WEB_QA_BASE_URL).origin;
const reportPath = path.join(artifactDir, 'route-health.json');
const ROUTE_CONCURRENCY = Math.max(1, Number(process.env.WEB_QA_ROUTE_CONCURRENCY || 8));
const ASSET_CONCURRENCY = Math.max(1, Number(process.env.WEB_QA_ASSET_CONCURRENCY || 12));
const REQUEST_TIMEOUT_MS = Math.max(1_000, Number(process.env.WEB_QA_REQUEST_TIMEOUT_MS || 12_000));

function stripMarkup(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFirstPartyUrl(raw, route) {
  if (!raw || /^(data:|blob:|javascript:|mailto:|tel:)/i.test(raw)) return null;
  try {
    const url = new URL(raw, route);
    if (url.origin !== baseOrigin) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function firstPartyAssets(html, route) {
  const assets = new Set();

  for (const match of html.matchAll(/<(?:img|script|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const normalized = normalizeFirstPartyUrl(match[1]?.trim(), route);
    if (normalized) assets.add(normalized);
  }

  for (const tagMatch of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    if (!/(?:^|\s)(?:stylesheet|icon|preload|modulepreload)(?:\s|$)/.test(rel)) continue;
    const normalized = normalizeFirstPartyUrl(href, route);
    if (normalized) assets.add(normalized);
  }

  return [...assets].slice(0, 100);
}

async function request(url, { method = 'GET', readBody = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'DTFSeeds-Deterministic-Web-QA/1.1' },
    });
    const contentType = response.headers.get('content-type') || '';
    const body = readBody ? await response.text() : '';
    if (!readBody) await response.body?.cancel().catch(() => {});
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: '',
      body: '',
      error: String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAsset(url) {
  let result = await request(url, { method: 'HEAD' });
  if (!result.ok && [0, 403, 405, 501].includes(result.status)) {
    result = await request(url, { method: 'GET' });
  }
  if (!result.ok) {
    return `${result.status || 'fetch-error'} ${url}${result.error ? ` (${result.error})` : ''}`;
  }
  return null;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

let manifest;
try {
  manifest = JSON.parse(await fs.readFile(routeFile, 'utf8'));
} catch (error) {
  console.error(`Route manifest unavailable: ${routeFile}`);
  console.error(String(error));
  process.exit(1);
}

const routes = Array.isArray(manifest.routes) && manifest.routes.length
  ? manifest.routes
  : [process.env.WEB_QA_BASE_URL || WEB_QA_BASE_URL];

const assetOwners = new Map();

const results = await mapLimit(routes, ROUTE_CONCURRENCY, async (route) => {
  const findings = [];
  const response = await request(route, { method: 'GET', readBody: true });

  if (!response.ok || response.status >= 400) {
    findings.push(`navigation: ${response.status || 'fetch-error'}${response.error ? ` ${response.error}` : ''}`);
  }

  const isHtml = /\btext\/html\b/i.test(response.contentType)
    || /<!doctype\s+html|<html[\s>]/i.test(response.body.slice(0, 5_000));
  if (!isHtml) findings.push(`content-type: expected HTML, received ${response.contentType || 'unknown'}`);

  if (response.body) {
    const visibleText = stripMarkup(response.body);
    if (visibleText.length <= 20) {
      findings.push(`content: only ${visibleText.length} characters after markup removal`);
    }
    if (!/<(?:main\b|h1\b)|\brole\s*=\s*["']main["']/i.test(response.body)) {
      findings.push('semantics: no main landmark, role=main, or h1 in server HTML');
    }

    for (const asset of firstPartyAssets(response.body, response.finalUrl || route)) {
      const owners = assetOwners.get(asset) || new Set();
      owners.add(route);
      assetOwners.set(asset, owners);
    }
  }

  return {
    route,
    finalUrl: response.finalUrl,
    status: response.status,
    findings,
  };
});

const resultByRoute = new Map(results.map((result) => [result.route, result]));
const uniqueAssets = [...assetOwners.keys()];
const assetFailures = await mapLimit(uniqueAssets, ASSET_CONCURRENCY, async (asset) => ({
  asset,
  failure: await checkAsset(asset),
}));

for (const { asset, failure } of assetFailures) {
  if (!failure) continue;
  for (const route of assetOwners.get(asset) || []) {
    resultByRoute.get(route)?.findings.push(`asset: ${failure}`);
  }
}

let findingCount = 0;
for (const result of results) {
  findingCount += result.findings.length;
  if (result.findings.length) {
    console.error(`Route health findings for ${result.route}:`);
    for (const finding of result.findings) console.error(`  - ${finding}`);
  } else {
    console.log(`OK ${result.status} ${result.route}`);
  }
}

await fs.mkdir(artifactDir, { recursive: true });
await fs.writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  routeCount: routes.length,
  uniqueAssetCount: uniqueAssets.length,
  findingCount,
  enforce,
  concurrency: {
    routes: ROUTE_CONCURRENCY,
    assets: ASSET_CONCURRENCY,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
  },
  results,
}, null, 2) + '\n');

console.log(`Checked ${routes.length} routes and ${uniqueAssets.length} unique first-party assets; ${findingCount} finding(s). Report: ${reportPath}`);
if (enforce && findingCount > 0) process.exit(1);
