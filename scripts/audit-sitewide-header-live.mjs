import { setDefaultResultOrder } from 'node:dns';
import { readFile, writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const BASE = new URL(process.env.DTF_SITE_URL || 'https://dtfseeds.com');
const MAX_PAGES = Number(process.env.DTF_HEADER_AUDIT_MAX_PAGES || 450);
const MAX_DEPTH = Number(process.env.DTF_HEADER_AUDIT_MAX_DEPTH || 5);
const CONCURRENCY = Number(process.env.DTF_HEADER_AUDIT_CONCURRENCY || 6);
const JSON_PATH = process.env.DTF_HEADER_AUDIT_JSON || 'sitewide-header-live-audit.json';
const MD_PATH = process.env.DTF_HEADER_AUDIT_MD || 'sitewide-header-live-audit.md';

const CONTENT_ENGINE_PREFIXES = [
  '/dtf-content-overlay/',
  '/learn/academy/',
  '/learn/atlas/',
  '/learn/cultivation-science/',
  '/learn/glossary/',
  '/learn/plant-health/',
  '/learn/search/',
  '/learn/sops/',
  '/learn/sources/',
  '/learn/subjects/',
  '/learn/symptoms/',
  '/learn/tools/'
];

const NON_HEADER_ROUTES = new Set([
  '/journal/',
  '/puzzles/'
]);

const RESOURCE_OWNED_ROUTES = new Set();

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNavLink(text, href, label) {
  const hrefPattern = escapeRegExp(href);
  const labelPattern = escapeRegExp(label);
  return new RegExp(`<a\\b(?=[^>]*href=["']${hrefPattern}["'])[^>]*>\\s*${labelPattern}\\s*<\\/a>`, 'i').test(text);
}

const REQUIRED = [
  { label: 'data-dtf-shell="header-v5"', test: body => body.includes('data-dtf-shell="header-v5"') },
  { label: '<a href="/seeds/">Seeds</a>', test: body => hasNavLink(body, '/seeds/', 'Seeds') },
  { label: '<a href="/learn/">Learn</a>', test: body => hasNavLink(body, '/learn/', 'Learn') },
  { label: '<a href="/courses/">Courses</a>', test: body => hasNavLink(body, '/courses/', 'Courses') },
  { label: '<a href="/tools/">Diagnostic</a>', test: body => hasNavLink(body, '/tools/', 'Diagnostic') },
  { label: '<a href="/games/">Games</a>', test: body => hasNavLink(body, '/games/', 'Games') },
  { label: '<a href="/community/">Community</a>', test: body => hasNavLink(body, '/community/', 'Community') },
  { label: '<a href="/shop/">Shop</a>', test: body => hasNavLink(body, '/shop/', 'Shop') },
  { label: 'Teaching', test: body => body.includes('Teaching') },
  { label: 'Healthy Cultivation', test: body => body.includes('Healthy Cultivation') }
];
const seeds = new Set([
  '/', '/seeds/', '/learn/', '/courses/', '/tools/', '/games/', '/community/', '/shop/',
  '/gallery/', '/about/', '/contact/', '/cart/', '/my-account/', '/growlens/', '/thc-grow-doc/'
]);

function sameOrigin(url) { return url.origin === BASE.origin; }
function cleanPath(input) {
  try {
    const url = new URL(input, BASE);
    if (!sameOrigin(url)) return null;
    url.hash = ''; url.search = '';
    let path = url.pathname.replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = `/${path}`;
    if (!path.endsWith('/') && !/\.[a-z0-9]{1,8}$/i.test(path)) path += '/';
    if (/\.(?:jpe?g|png|gif|webp|avif|svg|ico|css|js|mjs|map|json|xml|txt|pdf|zip|gz|mp4|webm|mp3|wav|woff2?|ttf|otf)$/i.test(path)) return null;
    if (/^\/(?:wp-admin|wp-json|wp-login\.php|feed|comments|xmlrpc\.php)(?:\/|$)/i.test(path)) return null;
    return path;
  } catch { return null; }
}

function exclusionReason(path) {
  if (NON_HEADER_ROUTES.has(path)) return 'non-page public data or retired route';
  if (RESOURCE_OWNED_ROUTES.has(path)) return 'resource-owned route; audited by its dedicated production publisher';
  if (CONTENT_ENGINE_PREFIXES.some(prefix => path.startsWith(prefix))) return 'content-engine route; audited by learning/content publication lanes';
  return '';
}

function linksFromHtml(html) {
  const out = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const path = cleanPath(match[1]);
    if (path && !exclusionReason(path)) out.push(path);
  }
  return out;
}

function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1].replaceAll('&amp;', '&'));
}

async function fetchText(url, accept = 'text/html,*/*') {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const bust = `${url.includes('?') ? '&' : '?'}dtf_header_audit=${Date.now()}-${attempt}`;
      const response = await fetch(`${url}${bust}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
        headers: { 'user-agent': 'DTFSeeds-Sitewide-Header-Audit/1.2', 'cache-control': 'no-cache, no-store', pragma: 'no-cache', accept }
      });
      return { response, body: await response.text(), error: null };
    } catch (error) { lastError = error; }
  }
  return { response: null, body: '', error: lastError instanceof Error ? lastError.message : String(lastError) };
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return null; }
}

async function addResourceOwnedRouteExclusions(path) {
  const raw = await readJson(path);
  const resources = raw?.resources && typeof raw.resources === 'object' ? Object.values(raw.resources) : [];
  for (const resource of resources) {
    if (resource?.publicSuiteOwnership !== 'resource') continue;
    const route = cleanPath(resource.route || '');
    if (route) RESOURCE_OWNED_ROUTES.add(route);
  }
}

async function addRegistrySeeds(path) {
  const raw = await readJson(path);
  if (!raw) return;
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && value.startsWith('/')) {
        const route = cleanPath(value);
        if (route && !exclusionReason(route)) seeds.add(route);
      }
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(raw);
}

await addResourceOwnedRouteExclusions('site/deployment/release-resources.json');
await Promise.all([
  addRegistrySeeds('site/deployment/public-apps.json'),
  addRegistrySeeds('data/public-navigation.json'),
  addRegistrySeeds('data/site-registry.json'),
  addRegistrySeeds('data/game-source-map.json')
]);

const sitemapCandidates = ['/wp-sitemap.xml', '/sitemap.xml', '/sitemap_index.xml'];
const seenSitemaps = new Set();
async function collectSitemap(path, depth = 0) {
  if (depth > 3 || seenSitemaps.has(path)) return;
  seenSitemaps.add(path);
  const { response, body } = await fetchText(new URL(path, BASE).href, 'application/xml,text/xml,text/plain,*/*');
  if (!response?.ok) return;
  for (const loc of sitemapLocs(body)) {
    let url; try { url = new URL(loc, BASE); } catch { continue; }
    if (!sameOrigin(url)) continue;
    if (/\.xml(?:$|\?)/i.test(url.pathname)) await collectSitemap(url.pathname, depth + 1);
    else {
      const route = cleanPath(url.href);
      if (route && !exclusionReason(route)) seeds.add(route);
    }
  }
}
for (const candidate of sitemapCandidates) await collectSitemap(candidate);

const queue = [...seeds].map(path => ({ path, depth: 0 }));
const queued = new Set(queue.map(x => x.path));
const visited = new Set();
const results = [];

async function inspect({ path, depth }) {
  if (visited.has(path) || visited.size >= MAX_PAGES) return;
  visited.add(path);
  const skippedReason = exclusionReason(path);
  if (skippedReason) {
    results.push({ path, status: null, html: false, passed: true, skipped: true, skippedReason, issues: [] });
    return;
  }
  const url = new URL(path, BASE).href;
  const { response, body, error } = await fetchText(url);
  if (error) { results.push({ path, status: 0, html: false, passed: false, skipped: false, issues: [`fetch failed: ${error}`] }); return; }
  const contentType = response.headers.get('content-type') || '';
  const isHtml = contentType.toLowerCase().includes('text/html') || /^\s*<!doctype html|^\s*<html\b/i.test(body);
  if (!isHtml) { results.push({ path, status: response.status, html: false, passed: true, skipped: false, issues: [] }); return; }

  const issues = [];
  if (!response.ok) issues.push(`HTTP ${response.status}`);
  if (response.ok) for (const check of REQUIRED) if (!check.test(body)) issues.push(`missing header marker: ${check.label}`);
  results.push({ path, status: response.status, html: true, passed: issues.length === 0, skipped: false, issues });

  if (response.ok && depth < MAX_DEPTH) {
    for (const next of linksFromHtml(body)) {
      if (queued.has(next) || visited.has(next) || queued.size >= MAX_PAGES) continue;
      queued.add(next); queue.push({ path: next, depth: depth + 1 });
    }
  }
}

let index = 0;
async function worker() {
  while (index < queue.length && visited.size < MAX_PAGES) {
    const item = queue[index++];
    await inspect(item);
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

const htmlResults = results.filter(r => r.html);
const skippedResults = results.filter(r => r.skipped);
const failures = htmlResults.filter(r => !r.passed);
const report = {
  generatedAt: new Date().toISOString(), baseUrl: BASE.href, requiredHeaderVersion: 5,
  scope: 'sitewide-header-managed-public-routes',
  discoveredRoutes: visited.size, htmlRoutes: htmlResults.length, passingHtmlRoutes: htmlResults.length - failures.length,
  skippedRoutes: skippedResults.length,
  resourceOwnedRoutesExcluded: [...RESOURCE_OWNED_ROUTES].sort(),
  contentEnginePrefixesExcluded: CONTENT_ENGINE_PREFIXES,
  failures, results: results.sort((a,b) => a.path.localeCompare(b.path))
};
await writeFile(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
const md = [
  '# Sitewide Header V5 Live Audit','',
  `Generated: ${report.generatedAt}`,'',
  `Scope: ${report.scope}`,'',
  `HTML routes passing: **${report.passingHtmlRoutes}/${report.htmlRoutes}**`,'',
  `Discovered same-origin routes: **${report.discoveredRoutes}**`,'',
  `Skipped out-of-scope routes: **${report.skippedRoutes}**`,'',
  failures.length ? '## Failures' : '## Result','',
  failures.length ? failures.map(x => `- \`${x.path}\` — ${x.issues.join('; ')}`).join('\n') : 'Every managed public HTML route exposes the approved V5 header contract.'
].join('\n');
await writeFile(MD_PATH, `${md}\n`);
console.log(md);
if (failures.length) process.exit(1);
