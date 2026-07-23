import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const BASE_URL = 'https://dtfseeds.com';
const JSON_REPORT = 'live-site-audit.json';
const MARKDOWN_REPORT = 'live-site-audit.md';

const bannedPublicPhrases = [
  'being rebuilt',
  'reserved strain card',
  'needed from owner',
  'tool-ready rebuild',
  'use this page for',
  'staged for verified',
  'before launch promotion',
  'email@email.com',
  '+123456789'
];

const routes = [
  { key: 'home', path: '/', minimumText: 500, requireDescription: true },
  { key: 'games', path: '/games/', minimumText: 500, requireDescription: true },
  { key: 'seeds', path: '/seeds/', minimumText: 400, requireDescription: true },
  { key: 'learn', path: '/learn/', minimumText: 500, requireDescription: true },
  { key: 'community', path: '/community/', minimumText: 300, requireDescription: true },
  { key: 'shop', path: '/shop/', minimumText: 250, requireDescription: true },
  { key: 'gallery', path: '/gallery/', minimumText: 250, requireDescription: true },
  { key: 'about', path: '/about/', minimumText: 300, requireDescription: true },
  { key: 'contact', path: '/contact/', minimumText: 250, requireDescription: true },
  {
    key: 'high-land',
    path: '/games/high-land/',
    minimumText: 80,
    requireDescription: true,
    requireCanonical: true,
    titleMustInclude: 'High Land'
  },
  {
    key: 'weedopolis',
    path: '/games/weedopolis/',
    minimumText: 100,
    requireDescription: true,
    requireCanonical: true,
    titleMustInclude: 'Weedopolis'
  },
  {
    key: 'high-iq',
    path: '/games/high-iq/',
    minimumText: 100,
    requireDescription: true,
    requireCanonical: true,
    titleMustInclude: 'High IQ'
  },
  {
    key: 'legacy-blog',
    path: '/blog/',
    allowedStatuses: [200, 301, 302, 307, 308, 404, 410],
    minimumText: 0,
    requireDescription: false,
    requireHeading: false,
    allowRedirectOrRemoval: true
  }
];

function decodeHtml(value = '') {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, attribute, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const target = String(value).toLowerCase();
  for (const tag of tags) {
    const attrValue = tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1];
    if (attrValue?.toLowerCase() !== target) continue;
    return decodeHtml(tag.match(/content=["']([^"']*)["']/i)?.[1] || '').trim();
  }
  return '';
}

function extractCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1] || '';
    if (!rel.toLowerCase().split(/\s+/).includes('canonical')) continue;
    return decodeHtml(tag.match(/href=["']([^"']+)["']/i)?.[1] || '').trim();
  }
  return '';
}

function countHeadings(html, level) {
  return (html.match(new RegExp(`<h${level}\\b`, 'gi')) || []).length;
}

function isNoIndex(html, headers) {
  const metaRobots = extractMeta(html, 'name', 'robots').toLowerCase();
  const headerRobots = (headers.get('x-robots-tag') || '').toLowerCase();
  return metaRobots.includes('noindex') || headerRobots.includes('noindex');
}

async function fetchRoute(route) {
  const requestedUrl = new URL(route.path, BASE_URL).href;
  const startedAt = Date.now();
  try {
    const response = await fetch(requestedUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'DTFSeeds-Live-QA/1.0 (+https://dtfseeds.com/)'
      }
    });
    const html = await response.text();
    return {
      route,
      requestedUrl,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      durationMs: Date.now() - startedAt,
      html,
      headers: response.headers,
      fetchError: null
    };
  } catch (error) {
    return {
      route,
      requestedUrl,
      finalUrl: requestedUrl,
      status: 0,
      contentType: '',
      durationMs: Date.now() - startedAt,
      html: '',
      headers: new Headers(),
      fetchError: error instanceof Error ? error.message : String(error)
    };
  }
}

function evaluate(result) {
  const { route, html, headers } = result;
  const text = stripHtml(html);
  const textLower = text.toLowerCase();
  const title = extractTitle(html);
  const description = extractMeta(html, 'name', 'description');
  const canonical = extractCanonical(html);
  const h1Count = countHeadings(html, 1);
  const issues = [];
  const warnings = [];
  const allowedStatuses = route.allowedStatuses || [200];

  if (result.fetchError) {
    issues.push(`Fetch failed: ${result.fetchError}`);
  } else if (!allowedStatuses.includes(result.status)) {
    issues.push(`Unexpected HTTP status ${result.status}; expected ${allowedStatuses.join(', ')}`);
  }

  const removedOrRedirected = route.allowRedirectOrRemoval && (
    [301, 302, 307, 308, 404, 410].includes(result.status) ||
    result.finalUrl !== result.requestedUrl
  );

  if (!removedOrRedirected && result.status === 200) {
    if (!result.contentType.toLowerCase().includes('text/html')) {
      issues.push(`Expected HTML but received ${result.contentType || 'no content type'}`);
    }
    if (!title) issues.push('Missing document title');
    if (route.titleMustInclude && !title.toLowerCase().includes(route.titleMustInclude.toLowerCase())) {
      issues.push(`Title must include “${route.titleMustInclude}”`);
    }
    if (route.requireDescription && !description) issues.push('Missing meta description');
    if (route.requireCanonical && !canonical) issues.push('Missing canonical URL');
    if (route.requireCanonical && canonical && canonical !== result.requestedUrl) {
      issues.push(`Canonical points to ${canonical} instead of ${result.requestedUrl}`);
    }
    if (route.requireHeading !== false && h1Count === 0) issues.push('Missing crawlable H1');
    if (text.length < route.minimumText) {
      issues.push(`Only ${text.length} crawlable text characters; expected at least ${route.minimumText}`);
    }
    if (isNoIndex(html, headers)) issues.push('Page is marked noindex');
  }

  for (const phrase of bannedPublicPhrases) {
    if (html.toLowerCase().includes(phrase) || textLower.includes(phrase)) {
      issues.push(`Public staging or fake-data phrase found: “${phrase}”`);
    }
  }

  if (result.durationMs > 3000) warnings.push(`Slow response: ${result.durationMs} ms`);
  if (description.length > 170) warnings.push(`Meta description is long (${description.length} characters)`);
  if (title.length > 65) warnings.push(`Title is long (${title.length} characters)`);

  return {
    key: route.key,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    durationMs: result.durationMs,
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
  const byTitle = new Map();
  for (const result of results) {
    const normalized = result.title.toLowerCase().trim();
    if (!normalized || result.status !== 200) continue;
    if (!byTitle.has(normalized)) byTitle.set(normalized, []);
    byTitle.get(normalized).push(result);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const keys = group.map((result) => result.key).join(', ');
    for (const result of group) {
      result.issues.push(`Duplicate title shared by: ${keys}`);
      result.passed = false;
    }
  }
}

function renderMarkdown(report) {
  const lines = [
    '# DTFSeeds Live-Site Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Overall: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    `Routes passing: **${report.summary.passed}/${report.summary.total}**`,
    '',
    '| Route | HTTP | Text | Time | Result |',
    '|---|---:|---:|---:|---|'
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.key} | ${result.status || 'ERR'} | ${result.crawlableTextCharacters} | ${result.durationMs} ms | ${result.passed ? 'PASS' : 'FAIL'} |`
    );
  }

  for (const result of report.results) {
    if (result.issues.length === 0 && result.warnings.length === 0) continue;
    lines.push('', `## ${result.key}`, '', `URL: ${result.requestedUrl}`, '');
    if (result.issues.length) {
      lines.push('### Failures', '');
      for (const issue of result.issues) lines.push(`- ${issue}`);
    }
    if (result.warnings.length) {
      lines.push('', '### Warnings', '');
      for (const warning of result.warnings) lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

const fetched = await Promise.all(routes.map(fetchRoute));
const results = fetched.map(evaluate);
addDuplicateTitleIssues(results);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  passed: results.every((result) => result.passed),
  summary: {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    warnings: results.reduce((sum, result) => sum + result.warnings.length, 0)
  },
  results
};

await Promise.all([
  writeFile(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(MARKDOWN_REPORT, renderMarkdown(report), 'utf8')
]);

console.log(renderMarkdown(report));
if (!report.passed) process.exitCode = 1;
