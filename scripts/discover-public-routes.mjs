import fs from 'node:fs/promises';
import path from 'node:path';
import {
  WEB_QA_BASE_URL,
  WEB_QA_ROUTE_FILE,
  WEB_QA_MAX_ROUTES,
  destructivePathFragments,
  ignoredExtensions,
} from '../web-qa.config.mjs';

const base = new URL(process.env.WEB_QA_BASE_URL || WEB_QA_BASE_URL);
const output = process.env.WEB_QA_ROUTE_FILE || WEB_QA_ROUTE_FILE;
const maxRoutes = Number(process.env.WEB_QA_MAX_ROUTES || WEB_QA_MAX_ROUTES);
const seen = new Set();
const validHtmlRoutes = new Set();
const queued = [];
const sitemapVisited = new Set();

function normalize(raw) {
  try {
    const url = new URL(raw, base);
    if (url.origin !== base.origin) return null;
    url.hash = '';
    if ([...destructivePathFragments].some((fragment) => url.pathname.toLowerCase().includes(fragment))) return null;
    const lower = url.pathname.toLowerCase();
    if ([...ignoredExtensions].some((ext) => lower.endsWith(ext))) return null;
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$)/i.test(key)) params.delete(key);
    }
    const query = params.toString();
    url.search = query ? `?${query}` : '';
    if (url.pathname !== '/' && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

function add(raw) {
  const normalized = normalize(raw);
  if (!normalized || seen.has(normalized) || seen.size >= maxRoutes) return;
  seen.add(normalized);
  queued.push(normalized);
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, '&'));
}

function extractLinks(html, currentUrl) {
  const links = [];
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try { links.push(new URL(href, currentUrl).toString()); } catch {}
  }
  return links;
}

async function fetchText(url, accept = '*/*') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'DTFSeeds-Web-QA/1.0', accept },
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      return { ok: false, status: response.status, url: response.url, contentType, text: '' };
    }
    return {
      ok: true,
      status: response.status,
      url: response.url,
      contentType,
      text: await response.text(),
    };
  } catch (error) {
    return { ok: false, status: 0, url, contentType: '', text: '', error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function isHtmlDocument(result) {
  if (!result.ok) return false;
  if (/\btext\/html\b/i.test(result.contentType)) return true;
  return /<!doctype\s+html|<html[\s>]/i.test(result.text.slice(0, 5000));
}

async function readSitemap(url) {
  const normalized = new URL(url, base).toString();
  if (sitemapVisited.has(normalized) || sitemapVisited.size > 40) return;
  sitemapVisited.add(normalized);
  const result = await fetchText(normalized, 'application/xml,text/xml,*/*');
  if (!result.ok) return;
  for (const loc of extractLocs(result.text)) {
    if (/\.xml($|\?)/i.test(loc)) await readSitemap(loc);
    else add(loc);
  }
}

add(base.toString());
await readSitemap(new URL('/sitemap.xml', base));
await readSitemap(new URL('/sitemap_index.xml', base));

for (let index = 0; index < queued.length && index < maxRoutes; index += 1) {
  const current = queued[index];
  const result = await fetchText(current, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1');
  if (!isHtmlDocument(result)) {
    console.log(`Skipping non-HTML route: ${current} (${result.status || 'fetch-error'} ${result.contentType || 'unknown-type'})`);
    continue;
  }

  const finalUrl = normalize(result.url || current);
  if (finalUrl) validHtmlRoutes.add(finalUrl);
  for (const link of extractLinks(result.text, result.url || current)) add(link);
}

const routes = [...validHtmlRoutes].sort();
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ baseUrl: base.origin, generatedAt: new Date().toISOString(), count: routes.length, routes }, null, 2) + '\n');
console.log(`Discovered ${routes.length} public first-party HTML routes for ${base.origin}`);
for (const route of routes) console.log(route);
