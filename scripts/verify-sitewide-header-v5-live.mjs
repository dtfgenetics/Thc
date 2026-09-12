import process from 'node:process';

const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const origin = new URL(site).origin;
const concurrency = Math.max(1, Math.min(12, Number(process.env.HEADER_AUDIT_CONCURRENCY || 6)));
const maxRoutes = Math.max(20, Math.min(2000, Number(process.env.HEADER_AUDIT_MAX_ROUTES || 800)));
const cacheKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNavLink(text, href, label) {
  const hrefPattern = escapeRegExp(href);
  const labelPattern = escapeRegExp(label);
  return new RegExp(`<a\\b(?=[^>]*href=["']${hrefPattern}["'])[^>]*>\\s*${labelPattern}\\s*<\\/a>`, 'i').test(text);
}

const required = [
  {
    label: 'data-dtf-shell="header-v5"',
    test: text => text.includes('data-dtf-shell="header-v5"')
  },
  {
    label: 'dtf-sitewide-header-v5-script',
    test: text => text.includes('dtf-sitewide-header-v5-script')
  },
  {
    label: '<a href="/">Home</a>',
    test: text => hasNavLink(text, '/', 'Home')
  },
  {
    label: '<a href="/seeds/">Seeds</a>',
    test: text => hasNavLink(text, '/seeds/', 'Seeds')
  },
  {
    label: '<a href="/learn/">Learn</a>',
    test: text => hasNavLink(text, '/learn/', 'Learn')
  },
  {
    label: '<a href="/courses/">Courses</a>',
    test: text => hasNavLink(text, '/courses/', 'Courses')
  },
  {
    label: '<a href="/tools/">Diagnostic</a>',
    test: text => hasNavLink(text, '/tools/', 'Diagnostic')
  },
  {
    label: '<a href="/games/">Games</a>',
    test: text => hasNavLink(text, '/games/', 'Games')
  },
  {
    label: '<a href="/community/">Community</a>',
    test: text => hasNavLink(text, '/community/', 'Community')
  },
  {
    label: '<a href="/shop/">Shop</a>',
    test: text => hasNavLink(text, '/shop/', 'Shop')
  }
];

const seedRoutes = [
  '/', '/seeds/', '/learn/', '/courses/', '/tools/', '/games/', '/community/', '/shop/',
  '/cart/', '/my-account/'
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url, { attempts = 3 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
        headers: {
          'User-Agent': 'DTF-Sitewide-Header-V5-Audit/1.1',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache'
        }
      });
      const text = await response.text();
      if (response.ok) return { response, text };
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      last = error;
    }
    if (attempt < attempts) await sleep(attempt * 500);
  }
  throw last;
}

function extractLocs(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map(match => match[1].replaceAll('&amp;', '&').trim())
    .filter(Boolean);
}

function normalizeRoute(input) {
  try {
    const url = new URL(input, origin);
    if (url.origin !== origin) return null;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|xml|txt|json|zip|mp4|webm|mp3|woff2?|ttf|ico)$/i.test(url.pathname)) return null;
    url.search = '';
    url.hash = '';
    return `${url.pathname}${url.search}` || '/';
  } catch {
    return null;
  }
}

async function discoverRoutes() {
  const routes = new Set(seedRoutes);
  const sitemapCandidates = ['/wp-sitemap.xml', '/sitemap_index.xml'];
  let sitemapFound = false;
  for (const candidate of sitemapCandidates) {
    try {
      const { text } = await fetchText(`${site}${candidate}?dtf_header_audit=${cacheKey}`, { attempts: 2 });
      const locs = extractLocs(text);
      if (!locs.length) continue;
      sitemapFound = true;
      const sitemapLocs = locs.filter(loc => /sitemap/i.test(loc) && !/wp-sitemap-users/i.test(loc));
      const pageLocs = locs.filter(loc => !/sitemap/i.test(loc));
      for (const loc of pageLocs) {
        const route = normalizeRoute(loc);
        if (route) routes.add(route);
      }
      for (const sitemapUrl of sitemapLocs.slice(0, 100)) {
        try {
          const { text: child } = await fetchText(`${sitemapUrl}${sitemapUrl.includes('?') ? '&' : '?'}dtf_header_audit=${cacheKey}`, { attempts: 2 });
          for (const loc of extractLocs(child)) {
            const route = normalizeRoute(loc);
            if (route) routes.add(route);
            if (routes.size >= maxRoutes) break;
          }
        } catch (error) {
          console.warn(`Sitemap child warning: ${sitemapUrl}: ${error.message}`);
        }
        if (routes.size >= maxRoutes) break;
      }
      break;
    } catch (error) {
      console.warn(`Sitemap discovery warning: ${candidate}: ${error.message}`);
    }
  }
  return { routes: [...routes].slice(0, maxRoutes), sitemapFound };
}

async function inspectRoute(route) {
  const separator = route.includes('?') ? '&' : '?';
  const url = `${site}${route}${separator}dtf_header_audit=${cacheKey}`;
  try {
    const { response, text } = await fetchText(url);
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return { route, status: response.status, skipped: 'non-html' };
    const missing = required.filter(check => !check.test(text)).map(check => check.label);
    const oldLabels = [];
    if (/class=["'][^"']*(?:dtf-shell-nav|dtf-global-nav)[^"']*["'][\s\S]{0,2500}>Genetics<\/a>/i.test(text)) oldLabels.push('Genetics nav label');
    if (/class=["'][^"']*(?:dtf-shell-nav|dtf-global-nav)[^"']*["'][\s\S]{0,2500}>Tools<\/a>/i.test(text)) oldLabels.push('Tools nav label');
    return { route, status: response.status, bytes: text.length, missing, oldLabels };
  } catch (error) {
    return { route, error: error.message };
  }
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

const { routes, sitemapFound } = await discoverRoutes();
const results = await mapLimit(routes, concurrency, inspectRoute);
const failures = results.filter(result => result.error || (result.missing?.length ?? 0) > 0 || (result.oldLabels?.length ?? 0) > 0);
const checked = results.filter(result => !result.skipped).length;
const report = {
  result: failures.length ? 'failure' : 'success',
  site,
  sitemapFound,
  discoveredRoutes: routes.length,
  checkedHtmlRoutes: checked,
  concurrency,
  failures,
  results
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
