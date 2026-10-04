import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center';
const sourceRoot = join(process.cwd(), 'site/public-route-patch/learn');
const searchIndex = JSON.parse(await readFile(join(sourceRoot,'search/search-index.json'),'utf8'));
const encyclopediaIndex = JSON.parse(await readFile(join(sourceRoot,'encyclopedia/encyclopedia-index.json'),'utf8'));

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Publisher/1.1' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-pages-${stamp}`);
await mkdir(backupDir, { recursive: true });

// Full WordPress-owned learning pages only. Dtf420 migration-overlay routes
// (academy compatibility, glossary, SOPs, plant health and expansion routes)
// must not be rewritten here; their backing/publication paths are governed separately.
const routes = [
  { slug: 'library', title: 'Teaching Healthy Cultivation Education Library' },
  { slug: 'start-here', title: 'Start Here — Teaching Healthy Cultivation' },
  { slug: 'beginner-guides', title: 'Beginner Grow Guides — Teaching Healthy Cultivation' },
  { slug: 'encyclopedia', title: 'THC Plant Science Encyclopedia' },
  { slug: 'records', title: 'Grow Records & Printables — Teaching Healthy Cultivation' },
  { slug: 'search', title: 'Search THC Education — Teaching Healthy Cultivation' },
  { slug: 'setup', title: 'Set Up Before You Grow' },
  { slug: 'root-zone', title: 'Root Zone, Water, and Nutrition' },
  { slug: 'environment', title: 'Light, Climate, and Canopy Environment' },
  { slug: 'propagation', title: 'Genetics, Crop Planning, Mother Stock, Cloning, and Propagation' },
];

const transientStatuses = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const maxAttempts = Number(options.maxAttempts || 5);
  const retrySafe = method === 'GET'
    || /^\/wp-json\/wp\/v2\/pages\/\d+$/.test(path)
    || /^\/wp-json\/dtf-learning\/v1\/index\/(?:search|encyclopedia)$/.test(path);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }

      if (response.ok) return body;

      const message = `${method} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`;
      lastError = new Error(message);
      if (!retrySafe || !transientStatuses.has(response.status) || attempt === maxAttempts) throw lastError;
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      const delayMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : Math.min(2000 * (2 ** (attempt - 1)), 16_000);
      console.warn(`Transient WordPress response ${response.status} for ${method} ${path}; retrying attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms.`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      const retryableNetworkError = error?.name === 'TimeoutError' || error?.name === 'AbortError' || error instanceof TypeError;
      if (!retrySafe || !retryableNetworkError || attempt === maxAttempts) throw error;
      const delayMs = Math.min(2000 * (2 ** (attempt - 1)), 16_000);
      console.warn(`Transient WordPress network error for ${method} ${path}; retrying attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms: ${error.message}`);
      await sleep(delayMs);
    }
  }
  throw lastError || new Error(`${method} ${path} failed after ${maxAttempts} attempts`);
}

function extract(html, pattern, label) {
  const match = html.match(pattern);
  if (!match) throw new Error(`Generated page is missing ${label}`);
  return match[1];
}

function sourceContent(html) {
  const style = extract(html, /(<style>[\s\S]*?<\/style>)/i, 'style block');
  const main = extract(html, /<main[^>]*>([\s\S]*?)<\/main>/i, 'main content');
  return `${style}\n<!-- DTF-PUBLIC-LEARNING-PAGE -->\n${main}`;
}

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(learnRows) || learnRows.length !== 1) {
  throw new Error(`Expected exactly one Learn parent page, found ${Array.isArray(learnRows) ? learnRows.length : 'invalid response'}`);
}
const learn = learnRows[0];

const results = [];
for (const route of routes) {
  const html = await readFile(join(sourceRoot, route.slug, 'index.html'), 'utf8');
  const content = sourceContent(html);
  const candidates = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(route.slug)}&context=edit&per_page=100`);
  const children = Array.isArray(candidates) ? candidates.filter((page) => Number(page.parent) === Number(learn.id)) : [];
  if (children.length > 1) throw new Error(`Multiple /learn/${route.slug}/ child pages exist; refusing ambiguous update.`);

  let page = children[0] || null;
  if (page) {
    await writeFile(join(backupDir, `page-${page.id}-${route.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
    page = await request(`/wp-json/wp/v2/pages/${page.id}`, {
      method: 'POST',
      body: JSON.stringify({ title: route.title, slug: route.slug, parent: learn.id, content, status: 'publish' }),
    });
    results.push({ slug: route.slug, id: page.id, action: 'updated', url: `${siteUrl}/learn/${route.slug}/` });
  } else {
    page = await request('/wp-json/wp/v2/pages', {
      method: 'POST',
      body: JSON.stringify({ title: route.title, slug: route.slug, parent: learn.id, content, status: 'publish' }),
    });
    await writeFile(join(backupDir, `page-${page.id}-${route.slug}-created.json`), `${JSON.stringify(page, null, 2)}\n`);
    results.push({ slug: route.slug, id: page.id, action: 'created', url: `${siteUrl}/learn/${route.slug}/` });
  }
}

const searchIndexResult = await request('/wp-json/dtf-learning/v1/index/search', {
  method: 'POST',
  body: JSON.stringify(searchIndex),
});
const encyclopediaIndexResult = await request('/wp-json/dtf-learning/v1/index/encyclopedia', {
  method: 'POST',
  body: JSON.stringify(encyclopediaIndex),
});
const runtimeHealth = await request('/wp-json/dtf-learning/v1/health');
if (!runtimeHealth?.ok || !runtimeHealth?.searchReady || !runtimeHealth?.encyclopediaReady) {
  throw new Error('DTF Learning Search runtime health check failed after index publication.');
}

for (const result of results) {
  let html = '';
  let ok = false;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await fetch(`${result.url}?dtf_learning=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Learning-Publisher/1.1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    });
    html = await response.text();
    if (response.ok && html.includes('Teaching Healthy Cultivation') && html.includes('/learn/')) {
      ok = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!ok) throw new Error(`Visitor-facing verification failed for ${result.url}`);
  if (['search','encyclopedia'].includes(result.slug)) {
    if (!html.includes('data-dtf-learning-search-runtime="mu-v1"')) throw new Error(`MU-plugin search runtime marker missing on ${result.url}`);
    if (!html.includes('data-dtf-learning-search-bootstrap="mu-v1"')) throw new Error(`MU-plugin search bootstrap missing on ${result.url}`);
    if (!html.includes('data-static-fallback')) throw new Error(`Static crawlable fallback missing on ${result.url}`);
    if (result.slug === 'encyclopedia') {
      if (!html.includes('DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START')) throw new Error(`Static encyclopedia fallback marker missing on ${result.url}`);
      if (!html.includes('THC-ENC-420')) throw new Error(`Static encyclopedia fallback does not prove the completed THC-ENC-420 publication floor on ${result.url}`);
    }
    if (result.slug === 'search' && !html.includes('DTF_STATIC_SEARCH_FALLBACK_START')) {
      throw new Error(`Static education-search fallback marker missing on ${result.url}`);
    }
  }
  for (const forbidden of ['email@email.com', '+123456789', 'being rebuilt', 'Needed from owner']) {
    if (html.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Stale placeholder content found on ${result.url}: ${forbidden}`);
  }
}

await writeFile(join(backupDir, 'publish-result.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), learnParentId: learn.id, results }, null, 2)}\n`);
await writeFile(join(backupRoot, 'learning-pages-backup-path.txt'), `${backupDir}\n`);

console.log(JSON.stringify({
  learnParentId: learn.id,
  created: results.filter((x) => x.action === 'created').length,
  updated: results.filter((x) => x.action === 'updated').length,
  verified: results.length,
  backupDir,
  searchIndex: searchIndexResult,
  encyclopediaIndex: encyclopediaIndexResult,
  runtimeHealth,
  results,
}, null, 2));
