import { setDefaultResultOrder } from 'node:dns';
import { writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const BASE_URL = 'https://dtfseeds.com';
const JSON_REPORT = 'live-site-audit.json';
const MARKDOWN_REPORT = 'live-site-audit.md';

const bannedPublicPhrases = [
  'being rebuilt',
  'reserved strain card',
  'needed from owner',
  'tool-ready rebuild',
  'staged for verified',
  'before launch promotion',
  'email@email.com',
  '+123456789'
];

const routes = [
  {
    key: 'home', path: '/', minimumText: 900,
    requiredText: ['Genetics first. Learn the plant behind the pack.', 'Blue Mango', 'Blue Bubblegum', 'Teaching Healthy Cultivation'],
    requiredLinks: ['/seeds/', '/learn/', '/tools/', '/games/', '/community/', '/shop/']
  },
  {
    key: 'seeds', path: '/seeds/', minimumText: 650,
    requiredText: ['DTF Genetics library', 'Blue Mango', 'Blue Bubblegum', 'Mango Bubbles'],
    requiredLinks: ['/seeds/blue-mango/', '/seeds/blue-bubblegum/', '/shop/']
  },
  {
    key: 'learn', path: '/learn/', minimumText: 1200,
    requiredText: ['Learn in a sequence that makes the plant easier to understand.', 'Plant Biology & Anatomy', 'Environment & VPD', 'Plant Health & IPM'],
    requiredLinks: ['/learn/start-here/', '/learn/academy/', '/learn/encyclopedia/', '/learn/infographics/']
  },
  {
    key: 'shop', path: '/shop/', minimumText: 250,
    requiredText: ['10 Feminized F2 Blue Mango Seeds', '10 Regular F1 Blue Bubblegum Seeds', '10 Regular F2 Blue Mango Seeds'],
    requiredLinks: ['/product/10-feminized-f2-blue-mango-x/', '/product/10-reg-f1-blueberry-bubblegum/', '/product/10-regular-f2-blue-mango-seeds/']
  },
  {
    key: 'tools', path: '/tools/', minimumText: 600,
    requiredText: ['Measure it. Document it. Diagnose with context.', 'THC GrowLens', 'THC Grow Doc'],
    requiredLinks: ['/seeds/', '/shop/', '/growlens/', '/thc-grow-doc/']
  },
  {
    key: 'games', path: '/games/', minimumText: 900,
    requiredText: ['Pick what is playable. See what is coming next.', 'High IQ', 'High Land', 'Protect the Plants'],
    requiredLinks: ['/seeds/', '/shop/', '/games/high-iq/', '/games/high-land/', '/games/protect-the-plants/']
  },
  {
    key: 'community', path: '/community/', minimumText: 300,
    requiredText: ['Discord'], requiredLinks: ['https://discord.gg/xJbUeHFPMt']
  },
  { key: 'gallery', path: '/gallery/', minimumText: 250 },
  { key: 'about', path: '/about/', minimumText: 300 },
  { key: 'contact', path: '/contact/', minimumText: 250, requiredText: ['Discord'] },
  {
    key: 'yellow-leaves', path: '/yellow-leaves/', minimumText: 1000,
    requiredText: ['Yellow leaves are a symptom, not a diagnosis']
  },
  {
    key: 'high-land', path: '/games/high-land/', minimumText: 80,
    titleMustInclude: 'High Land'
  },
  {
    key: 'high-iq', path: '/games/high-iq/', minimumText: 500,
    titleMustInclude: 'High IQ', requiredText: ['High IQ']
  },
  {
    key: 'protect-the-plants', path: '/games/protect-the-plants/', minimumText: 100,
    titleMustInclude: 'Protect the Plants', requiredText: ['Protect the Plants']
  }
];

function decodeHtml(value = '') {
  return String(value)
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(html) {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag, name) {
  return decodeHtml(tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1] || '').trim();
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
}

function extractMeta(html, name) {
  const target = String(name).toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (attr(tag, 'name').toLowerCase() === target || attr(tag, 'property').toLowerCase() === target) return attr(tag, 'content');
  }
  return '';
}

function extractCanonical(html) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(tag, 'href');
  }
  return '';
}

function countHeadings(html, level) {
  return (html.match(new RegExp(`<h${level}\\b`, 'gi')) || []).length;
}

function isNoIndex(html, headers) {
  const robots = `${extractMeta(html, 'robots')} ${headers.get('x-robots-tag') || ''}`.toLowerCase();
  return robots.includes('noindex');
}

function normalizedUrl(path) {
  return new URL(path, BASE_URL).href;
}

function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  return error.cause?.message ? `${error.message}: ${error.cause.message}` : error.message;
}

async function fetchText(url, { timeout = 20_000, accept = 'text/html,*/*' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    try {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}dtf_audit=${Date.now()}-${attempt}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: {
          'user-agent': 'DTFSeeds-Live-QA/2.0 (+https://dtfseeds.com/)',
          'cache-control': 'no-cache',
          accept
        }
      });
      const body = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        contentType: response.headers.get('content-type') || '',
        headers: response.headers,
        body,
        durationMs: Date.now() - startedAt,
        error: null
      };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, status: 0, finalUrl: url, contentType: '', headers: new Headers(), body: '', durationMs: 0, error: describeError(lastError) };
}

async function auditRoute(route) {
  const requestedUrl = normalizedUrl(route.path);
  const fetched = await fetchText(requestedUrl);
  const html = fetched.body;
  const text = stripHtml(html);
  const htmlLower = html.toLowerCase();
  const textLower = text.toLowerCase();
  const title = extractTitle(html);
  const description = extractMeta(html, 'description');
  const canonical = extractCanonical(html);
  const h1Count = countHeadings(html, 1);
  const issues = [];
  const warnings = [];

  if (fetched.error) issues.push(`Fetch failed: ${fetched.error}`);
  if (!fetched.error && fetched.status !== 200) issues.push(`Unexpected HTTP status ${fetched.status}; expected 200`);

  if (fetched.status === 200) {
    if (!fetched.contentType.toLowerCase().includes('text/html')) issues.push(`Expected HTML but received ${fetched.contentType || 'no content type'}`);
    if (!title) issues.push('Missing document title');
    if (!description) issues.push('Missing meta description');
    if (!canonical) issues.push('Missing canonical URL');
    if (canonical && canonical.replace(/\/$/, '') !== requestedUrl.replace(/\/$/, '')) issues.push(`Canonical points to ${canonical} instead of ${requestedUrl}`);
    if (h1Count < 1) issues.push('Missing crawlable H1');
    if (h1Count > 1) warnings.push(`Multiple H1 elements detected (${h1Count})`);
    if (text.length < route.minimumText) issues.push(`Only ${text.length} crawlable text characters; expected at least ${route.minimumText}`);
    if (isNoIndex(html, fetched.headers)) issues.push('Page is marked noindex');

    if (route.titleMustInclude && !title.toLowerCase().includes(route.titleMustInclude.toLowerCase())) {
      issues.push(`Document title must include “${route.titleMustInclude}”`);
    }

    for (const required of route.requiredText || []) {
      const normalized = required.toLowerCase();
      if (!textLower.includes(normalized) && !htmlLower.includes(normalized)) issues.push(`Required current content missing: “${required}”`);
    }
    for (const required of route.requiredLinks || []) {
      if (!html.includes(required)) issues.push(`Required current route/link missing: “${required}”`);
    }
    for (const phrase of bannedPublicPhrases) {
      const normalized = phrase.toLowerCase();
      if (textLower.includes(normalized) || htmlLower.includes(normalized)) issues.push(`Public staging/fake-data phrase found: “${phrase}”`);
    }
  }

  if (fetched.durationMs > 4000) warnings.push(`Slow response: ${fetched.durationMs} ms`);
  if (title.length > 65) warnings.push(`Title is long (${title.length} characters)`);
  if (description.length > 170) warnings.push(`Meta description is long (${description.length} characters)`);

  return {
    key: route.key,
    requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    durationMs: fetched.durationMs,
    title,
    description,
    canonical,
    h1Count,
    crawlableTextCharacters: text.length,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    passed: issues.length === 0
  };
}

function addDuplicateTitleIssues(results) {
  const groups = new Map();
  for (const result of results) {
    const key = result.title.toLowerCase().trim();
    if (!key || result.status !== 200) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const names = group.map((item) => item.key).join(', ');
    for (const item of group) {
      item.issues.push(`Duplicate title shared by: ${names}`);
      item.passed = false;
    }
  }
}

async function auditIndexability() {
  const issues = [];
  const warnings = [];
  const robotsUrl = normalizedUrl('/robots.txt');
  const robots = await fetchText(robotsUrl, { accept: 'text/plain,*/*' });
  const robotsText = robots.body || '';

  if (robots.status !== 200) issues.push(`robots.txt returned HTTP ${robots.status || 'ERR'}`);
  const groups = robotsText.split(/(?=^User-agent:)/gim);
  for (const group of groups) {
    if (!/^User-agent:\s*\*/im.test(group)) continue;
    if (/^Disallow:\s*\/\s*$/im.test(group)) issues.push('robots.txt disallows the entire site for User-agent: *');
  }

  const declared = [...robotsText.matchAll(/^Sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  const candidates = [...new Set([...declared, normalizedUrl('/sitemap.xml'), normalizedUrl('/sitemap_index.xml'), normalizedUrl('/wp-sitemap.xml')])];
  const probes = [];
  let working = null;
  for (const candidate of candidates) {
    const result = await fetchText(candidate, { accept: 'application/xml,text/xml,text/plain,*/*' });
    const looksXml = /<(?:urlset|sitemapindex)\b/i.test(result.body || '');
    const locCount = (result.body.match(/<loc>/gi) || []).length;
    const probe = { url: candidate, status: result.status, contentType: result.contentType, looksXml, locCount };
    probes.push(probe);
    if (!working && result.status === 200 && looksXml && locCount > 0) working = probe;
  }

  if (!working) issues.push('No working XML sitemap was found at robots-declared or standard sitemap locations');
  if (working && !declared.length) warnings.push(`robots.txt does not declare a Sitemap line; discovered ${working.url} directly`);

  return {
    robotsUrl,
    robotsStatus: robots.status,
    sitemapDeclared: declared,
    sitemapProbes: probes,
    workingSitemap: working?.url || null,
    issues,
    warnings,
    passed: issues.length === 0
  };
}

function renderMarkdown(report) {
  const lines = [
    '# DTFSeeds Live-Site Audit', '',
    `Generated: ${report.generatedAt}`, '',
    `Overall: **${report.passed ? 'PASS' : 'FAIL'}**`, '',
    `Routes passing: **${report.summary.passed}/${report.summary.total}**`, '',
    `Indexability: **${report.indexability.passed ? 'PASS' : 'FAIL'}**`, '',
    '| Route | HTTP | H1 | Text | Time | Result |',
    '|---|---:|---:|---:|---:|---|'
  ];

  for (const result of report.results) {
    lines.push(`| ${result.key} | ${result.status || 'ERR'} | ${result.h1Count} | ${result.crawlableTextCharacters} | ${result.durationMs} ms | ${result.passed ? 'PASS' : 'FAIL'} |`);
  }

  if (report.indexability.issues.length || report.indexability.warnings.length) {
    lines.push('', '## Indexability', '');
    for (const issue of report.indexability.issues) lines.push(`- FAIL: ${issue}`);
    for (const warning of report.indexability.warnings) lines.push(`- Warning: ${warning}`);
    if (report.indexability.workingSitemap) lines.push(`- Working sitemap: ${report.indexability.workingSitemap}`);
  }

  for (const result of report.results) {
    if (!result.issues.length && !result.warnings.length) continue;
    lines.push('', `## ${result.key}`, '', `URL: ${result.requestedUrl}`, '');
    for (const issue of result.issues) lines.push(`- FAIL: ${issue}`);
    for (const warning of result.warnings) lines.push(`- Warning: ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}

const [results, indexability] = await Promise.all([
  Promise.all(routes.map(auditRoute)),
  auditIndexability()
]);
addDuplicateTitleIssues(results);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  passed: results.every((result) => result.passed) && indexability.passed,
  summary: {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    warnings: results.reduce((sum, result) => sum + result.warnings.length, 0) + indexability.warnings.length
  },
  indexability,
  results
};

await Promise.all([
  writeFile(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(MARKDOWN_REPORT, renderMarkdown(report), 'utf8')
]);

console.log(renderMarkdown(report));
if (!report.passed) process.exitCode = 1;
