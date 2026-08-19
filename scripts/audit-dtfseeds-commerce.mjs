import { setDefaultResultOrder } from 'node:dns';
import { writeFile } from 'node:fs/promises';

setDefaultResultOrder('ipv4first');

const BASE_URL = 'https://dtfseeds.com';
const JSON_REPORT = 'commerce-audit.json';
const MARKDOWN_REPORT = 'commerce-audit.md';

const products = [
  {
    key: 'blue-mango-f2-regular',
    path: '/product/10-regular-f2-blue-mango-seeds/',
    titleIncludes: 'Blue Mango',
    requiredText: ['10 regular F2 Blue Mango Seeds'],
    bannedClaims: [
      'experience the pinnacle',
      'premium seeds',
      'high potential yields',
      'optimized growth cycle',
      'large yields',
      'commercial purposes',
      'deliver consistent phenotypes'
    ]
  },
  {
    key: 'blue-mango-f2-feminized',
    path: '/product/10-feminized-f2-blue-mango-x/',
    titleIncludes: 'Blue Mango',
    requiredText: ['blue mango']
  },
  {
    key: 'blueberry-bubblegum-f1-regular',
    path: '/product/10-reg-f1-blueberry-bubblegum/',
    titleIncludes: 'bubblegum',
    requiredText: ['bubblegum']
  }
];

const globalBannedPhrases = [
  'email@email.com',
  '+123456789',
  'category: uncategorized',
  '© 2025 dtf genetics'
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

function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (!cause) return error.message;
  if (cause instanceof Error) return `${error.message}: ${cause.message}`;
  if (typeof cause === 'object') {
    const code = cause.code ? ` ${cause.code}` : '';
    const message = cause.message ? `: ${cause.message}` : '';
    return `${error.message}${code}${message}`;
  }
  return `${error.message}: ${String(cause)}`;
}

async function fetchProduct(product) {
  const requestedUrl = new URL(product.path, BASE_URL).href;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${requestedUrl}?dtf_commerce_audit=${Date.now()}-${attempt}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'user-agent': 'DTFSeeds-Commerce-QA/1.0 (+https://dtfseeds.com/)',
          'cache-control': 'no-cache'
        }
      });
      const html = await response.text();
      return {
        product,
        requestedUrl,
        finalUrl: response.url,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        durationMs: Date.now() - startedAt,
        html,
        fetchError: null
      };
    } catch (error) {
      lastError = describeError(error);
    }
  }

  return {
    product,
    requestedUrl,
    finalUrl: requestedUrl,
    status: 0,
    contentType: '',
    durationMs: 0,
    html: '',
    fetchError: lastError || 'Unknown fetch failure'
  };
}

function evaluate(result) {
  const { product, html } = result;
  const text = stripHtml(html);
  const textLower = text.toLowerCase();
  const htmlLower = html.toLowerCase();
  const title = extractTitle(html);
  const issues = [];
  const warnings = [];

  if (result.fetchError) {
    issues.push(`Fetch failed after retries: ${result.fetchError}`);
  } else if (result.status !== 200) {
    issues.push(`Unexpected HTTP status ${result.status}; expected 200`);
  }

  if (result.status === 200) {
    if (!result.contentType.toLowerCase().includes('text/html')) {
      issues.push(`Expected HTML but received ${result.contentType || 'no content type'}`);
    }
    if (!title) issues.push('Missing document title');
    if (product.titleIncludes && !title.toLowerCase().includes(product.titleIncludes.toLowerCase())) {
      issues.push(`Document title must include “${product.titleIncludes}”`);
    }
    if (!/<h1\b/i.test(html)) issues.push('Missing product H1');

    for (const required of product.requiredText || []) {
      const normalized = required.toLowerCase();
      if (!textLower.includes(normalized) && !htmlLower.includes(normalized)) {
        issues.push(`Required product identity text is missing: “${required}”`);
      }
    }

    for (const phrase of globalBannedPhrases) {
      const normalized = phrase.toLowerCase();
      if (textLower.includes(normalized) || htmlLower.includes(normalized)) {
        issues.push(`Legacy commerce defect remains: “${phrase}”`);
      }
    }

    for (const phrase of product.bannedClaims || []) {
      const normalized = phrase.toLowerCase();
      if (textLower.includes(normalized) || htmlLower.includes(normalized)) {
        issues.push(`Overclaim or legacy product copy remains: “${phrase}”`);
      }
    }

    if (/\bhome\s+gallery\s+blog\b/i.test(text)) {
      warnings.push('Legacy Home / Gallery / Blog navigation pattern is still visible on the product page');
    }
  }

  if (result.durationMs > 4000) warnings.push(`Slow response: ${result.durationMs} ms`);

  return {
    key: product.key,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    durationMs: result.durationMs,
    title,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    passed: issues.length === 0
  };
}

function renderMarkdown(report) {
  const lines = [
    '# DTFSeeds Commerce Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Overall: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    `Products passing: **${report.summary.passed}/${report.summary.total}**`,
    '',
    '| Product route | HTTP | Time | Result |',
    '|---|---:|---:|---|'
  ];

  for (const result of report.results) {
    lines.push(`| ${result.key} | ${result.status || 'ERR'} | ${result.durationMs} ms | ${result.passed ? 'PASS' : 'FAIL'} |`);
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

const fetched = await Promise.all(products.map(fetchProduct));
const results = fetched.map(evaluate);

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
