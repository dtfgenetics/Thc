import { setDefaultResultOrder } from 'node:dns';
import { writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const BASE_URL = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const JSON_REPORT = 'live-visual-structure-audit.json';
const MARKDOWN_REPORT = 'live-visual-structure-audit.md';

const routes = [
  {
    key: 'home',
    path: '/',
    pageType: 'landing',
    requiredMarkers: ['Genetics first. Learn the plant behind the pack.', 'Current releases', 'Use the knowledge'],
    requiredLinks: ['/seeds/', '/learn/', '/tools/', '/games/', '/community/'],
    minSections: 5,
    minImages: 3,
    minCtas: 8,
    minH2: 4
  },
  {
    key: 'seeds',
    path: '/seeds/',
    pageType: 'catalog',
    requiredMarkers: ['DTF Genetics library', 'Blue Mango', 'Blue Bubblegum'],
    requiredLinks: ['/shop/'],
    minSections: 3,
    minImages: 2,
    minCtas: 5,
    minH2: 2
  },
  {
    key: 'learn',
    path: '/learn/',
    pageType: 'education',
    requiredMarkers: ['Learn in a sequence that makes the plant easier to understand.', 'Plant Biology & Anatomy', 'Environment & VPD'],
    requiredLinks: ['/learn/start-here/', '/learn/academy/', '/learn/encyclopedia/', '/learn/infographics/'],
    minSections: 5,
    minImages: 3,
    minCtas: 10,
    minH2: 4
  },
  {
    key: 'tools',
    path: '/tools/',
    pageType: 'utility',
    requiredMarkers: ['THC GrowLens', 'THC Grow Doc'],
    requiredLinks: ['/growlens/', '/thc-grow-doc/'],
    minSections: 3,
    minImages: 1,
    minCtas: 4,
    minH2: 2
  },
  {
    key: 'games',
    path: '/games/',
    pageType: 'hub',
    requiredMarkers: ['High IQ', 'High Land', 'Burn Buds'],
    requiredLinks: ['/games/high-iq/', '/games/high-land/'],
    minSections: 3,
    minImages: 1,
    minCtas: 4,
    minH2: 2
  },
  {
    key: 'community',
    path: '/community/',
    pageType: 'community',
    requiredMarkers: ['Discord'],
    requiredLinks: ['https://discord.gg/xJbUeHFPMt'],
    minSections: 2,
    minImages: 0,
    minCtas: 2,
    minH2: 1
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

function stripHtml(html = '') {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag, name) {
  return decodeHtml(tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1] || '').trim();
}

function count(pattern, html) {
  return (html.match(pattern) || []).length;
}

function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
}

function headingText(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))]
    .map(match => stripHtml(match[1]))
    .filter(Boolean);
}

function uniqueLinks(html) {
  const links = new Set();
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attr(tag, 'href');
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) links.add(href);
  }
  return [...links];
}

function imageStats(html) {
  const images = html.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = [];
  const unlabeledDecorative = [];
  const lazyCount = images.filter(tag => /loading=["']lazy["']/i.test(tag)).length;
  const eagerCount = images.filter(tag => /loading=["']eager["']|fetchpriority=["']high["']/i.test(tag)).length;

  images.forEach((tag, index) => {
    const src = attr(tag, 'src');
    const alt = attr(tag, 'alt');
    if (!/\salt=/i.test(tag)) missingAlt.push({ index, src });
    if (/\salt=["']["']/i.test(tag) && !/role=["']presentation["']|aria-hidden=["']true["']/i.test(tag)) unlabeledDecorative.push({ index, src });
  });

  return { total: images.length, lazyCount, eagerCount, missingAlt, unlabeledDecorative };
}

async function fetchHtml(path) {
  const url = new URL(path, BASE_URL);
  url.searchParams.set('dtf_visual_audit', `${Date.now()}`);
  const startedAt = Date.now();
  const response = await fetch(url.href, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'user-agent': 'DTFSeeds-Visual-Structure-Audit/1.0 (+https://dtfseeds.com/)',
      'cache-control': 'no-cache',
      accept: 'text/html,*/*'
    }
  });
  const body = await response.text();
  return { body, status: response.status, finalUrl: response.url, durationMs: Date.now() - startedAt, contentType: response.headers.get('content-type') || '' };
}

function scoreResult(result) {
  const penalty = result.issues.length * 16 + result.warnings.length * 5;
  return Math.max(0, Math.min(100, 100 - penalty));
}

async function auditRoute(route) {
  const issues = [];
  const warnings = [];
  let fetched;
  try {
    fetched = await fetchHtml(route.path);
  } catch (error) {
    return {
      key: route.key,
      path: route.path,
      pageType: route.pageType,
      status: 0,
      finalUrl: new URL(route.path, BASE_URL).href,
      durationMs: 0,
      title: '',
      headings: { h1: [], h2: [] },
      sections: 0,
      ctas: 0,
      images: { total: 0, lazyCount: 0, eagerCount: 0, missingAlt: [], unlabeledDecorative: [] },
      links: [],
      issues: [`Fetch failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
      score: 0,
      passed: false
    };
  }

  const html = fetched.body;
  const text = stripHtml(html);
  const title = extractTitle(html);
  const h1 = headingText(html, 1);
  const h2 = headingText(html, 2);
  const sections = count(/<section\b/gi, html);
  const cards = count(/class=["'][^"']*(?:card|feature|release|path|compact|subject|lesson)[^"']*["']/gi, html);
  const ctas = count(/<a\b[^>]*href=/gi, html);
  const links = uniqueLinks(html);
  const images = imageStats(html);
  const textLower = text.toLowerCase();
  const htmlLower = html.toLowerCase();

  if (fetched.status !== 200) issues.push(`HTTP ${fetched.status}; expected 200`);
  if (!fetched.contentType.toLowerCase().includes('text/html')) issues.push(`Expected HTML, received ${fetched.contentType || 'unknown content type'}`);
  if (!title) issues.push('Missing document title');
  if (h1.length !== 1) issues.push(`Expected exactly one H1; found ${h1.length}`);
  if (h2.length < route.minH2) issues.push(`Only ${h2.length} H2 headings; expected at least ${route.minH2}`);
  if (sections < route.minSections) issues.push(`Only ${sections} section blocks; expected at least ${route.minSections}`);
  if (ctas < route.minCtas) issues.push(`Only ${ctas} crawlable links/CTAs; expected at least ${route.minCtas}`);
  if (images.total < route.minImages) issues.push(`Only ${images.total} images; expected at least ${route.minImages}`);
  if (images.missingAlt.length) issues.push(`${images.missingAlt.length} images are missing alt attributes`);

  if (text.length < 550 && route.pageType !== 'community') warnings.push(`Short crawlable text (${text.length} characters)`);
  if (cards < 3 && ['landing', 'catalog', 'education', 'hub'].includes(route.pageType)) warnings.push(`Low card/module count (${cards}); page may feel flat`);
  if (images.total > 1 && images.lazyCount === 0) warnings.push('No lazy-loaded images detected after the hero area');
  if (images.total > 0 && images.eagerCount === 0 && ['landing', 'education', 'catalog'].includes(route.pageType)) warnings.push('No eager/high-priority hero image detected');
  if (fetched.durationMs > 3500) warnings.push(`Slow response: ${fetched.durationMs} ms`);

  for (const marker of route.requiredMarkers || []) {
    const normalized = marker.toLowerCase();
    if (!textLower.includes(normalized) && !htmlLower.includes(normalized)) issues.push(`Missing required visual/content marker: “${marker}”`);
  }
  for (const required of route.requiredLinks || []) {
    if (!html.includes(required)) issues.push(`Missing required navigation/CTA target: “${required}”`);
  }

  const result = {
    key: route.key,
    path: route.path,
    pageType: route.pageType,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    durationMs: fetched.durationMs,
    title,
    headings: { h1, h2 },
    sections,
    cards,
    ctas,
    crawlableTextCharacters: text.length,
    images,
    links,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)]
  };
  result.score = scoreResult(result);
  result.passed = result.issues.length === 0;
  return result;
}

function renderMarkdown(report) {
  const lines = [
    '# DTFSeeds Visual Structure Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Overall: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    `Average visual score: **${report.summary.averageScore}/100**`,
    '',
    '| Route | Type | Score | H1 | H2 | Sections | Images | CTAs | Result |',
    '|---|---|---:|---:|---:|---:|---:|---:|---|'
  ];

  for (const result of report.results) {
    lines.push(`| ${result.key} | ${result.pageType} | ${result.score} | ${result.headings.h1.length} | ${result.headings.h2.length} | ${result.sections} | ${result.images.total} | ${result.ctas} | ${result.passed ? 'PASS' : 'FAIL'} |`);
  }

  const failures = report.results.filter(result => result.issues.length || result.warnings.length);
  for (const result of failures) {
    lines.push('', `## ${result.key}`, '', `URL: ${result.finalUrl}`, '');
    for (const issue of result.issues) lines.push(`- FAIL: ${issue}`);
    for (const warning of result.warnings) lines.push(`- Warning: ${warning}`);
    if (result.headings.h1.length) lines.push(`- H1: ${result.headings.h1.join(' | ')}`);
  }

  lines.push('', '## Next visual fixes', '');
  lines.push('- Give every core page one clear hero, one primary CTA cluster, and a visible second section above the fold.');
  lines.push('- Keep genetics, learning, tools, games, and community modules visually distinct so visitors can route themselves fast.');
  lines.push('- Use large raster images with useful alt text; lazy-load everything below the first hero image.');
  lines.push('- Convert repeated text-only blocks into cards, callout strips, or step panels where it improves scanning.');

  return `${lines.join('\n')}\n`;
}

const results = await Promise.all(routes.map(auditRoute));
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  passed: results.every(result => result.passed),
  summary: {
    total: results.length,
    passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length,
    warnings: results.reduce((sum, result) => sum + result.warnings.length, 0),
    averageScore: Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length))
  },
  results
};

await Promise.all([
  writeFile(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(MARKDOWN_REPORT, renderMarkdown(report), 'utf8')
]);

console.log(renderMarkdown(report));
if (!report.passed) process.exitCode = 1;
