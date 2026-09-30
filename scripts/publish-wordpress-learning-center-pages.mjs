import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center';
const sourceRoot = join(process.cwd(), 'site/public-route-patch/learn');
const fuseSource = (await readFile(join(process.cwd(),'site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs'),'utf8'))
  .replace(/export\{G as default\};?\s*$/,'const Fuse=G;');
const explainSource = (await readFile(join(sourceRoot,'search/thc-search-explain-v1.mjs'),'utf8'))
  .replace(/^export\s+/gm,'');
const searchRuntimeSource = (await readFile(join(sourceRoot,'search/search-v1.mjs'),'utf8'))
  .replace(/^import\s+[^;]+;\s*$/gm,'');
const encyclopediaRuntimeSource = (await readFile(join(sourceRoot,'encyclopedia/encyclopedia-v1.mjs'),'utf8'))
  .replace(/^import\s+[^;]+;\s*$/gm,'');
const searchIndex = JSON.parse(await readFile(join(sourceRoot,'search/search-index.json'),'utf8'));
const encyclopediaIndex = JSON.parse(await readFile(join(sourceRoot,'encyclopedia/encyclopedia-index.json'),'utf8'));

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Publisher/1.1' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-pages-${stamp}`);
await mkdir(backupDir, { recursive: true });

const routes = [
  { slug: 'library', title: 'Teaching Healthy Cultivation Education Library' },
  { slug: 'start-here', title: 'Start Here — Teaching Healthy Cultivation' },
  { slug: 'beginner-guides', title: 'Beginner Grow Guides — Teaching Healthy Cultivation' },
  { slug: 'academy', title: 'THC Academy' },
  { slug: 'encyclopedia', title: 'THC Plant Science Encyclopedia' },
  { slug: 'sops', title: 'SOPs & Measurement — Teaching Healthy Cultivation' },
  { slug: 'glossary', title: 'Cultivation Glossary — Teaching Healthy Cultivation' },
  { slug: 'records', title: 'Grow Records & Printables — Teaching Healthy Cultivation' },
  { slug: 'search', title: 'Search THC Education — Teaching Healthy Cultivation' },
  { slug: 'setup', title: 'Set Up Before You Grow' },
  { slug: 'root-zone', title: 'Root Zone, Water, and Nutrition' },
  { slug: 'environment', title: 'Light, Climate, and Canopy Environment' },
  { slug: 'plant-health', title: 'Plant Health, Scouting, Disease, Pests, and IPM' },
  { slug: 'propagation', title: 'Genetics, Crop Planning, Mother Stock, Cloning, and Propagation' },
];

async function request(path, options = {}) {
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
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

function extract(html, pattern, label) {
  const match = html.match(pattern);
  if (!match) throw new Error(`Generated page is missing ${label}`);
  return match[1];
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g,'\\u003c').replace(/-->/g,'--\\u003e');
}

function embeddedSearchApp(slug) {
  if (!['search','encyclopedia'].includes(slug)) return '';
  const payload = slug === 'search'
    ? `window.__THC_SEARCH_INDEX__=${safeJson(searchIndex)};window.__THC_ENCYCLOPEDIA_INDEX__=${safeJson(encyclopediaIndex)};`
    : `window.__THC_ENCYCLOPEDIA_INDEX__=${safeJson(encyclopediaIndex)};`;
  const runtime = slug === 'search' ? searchRuntimeSource : encyclopediaRuntimeSource;
  return [
    '<div data-thc-search-app="embedded-v1" hidden></div>',
    '<script type="module" data-thc-search-runtime="embedded-v1">',
    payload,
    fuseSource,
    explainSource,
    runtime,
    '</script>'
  ].join('\n');
}

function sourceContent(html, slug) {
  const style = extract(html, /(<style>[\s\S]*?<\/style>)/i, 'style block');
  const main = extract(html, /<main[^>]*>([\s\S]*?)<\/main>/i, 'main content');
  return `${style}\n<!-- DTF-PUBLIC-LEARNING-PAGE -->\n${main}\n${embeddedSearchApp(slug)}`;
}

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(learnRows) || learnRows.length !== 1) {
  throw new Error(`Expected exactly one Learn parent page, found ${Array.isArray(learnRows) ? learnRows.length : 'invalid response'}`);
}
const learn = learnRows[0];

const results = [];
for (const route of routes) {
  const html = await readFile(join(sourceRoot, route.slug, 'index.html'), 'utf8');
  const content = sourceContent(html, route.slug);
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
    if (!html.includes('data-thc-search-app="embedded-v1"')) throw new Error(`Embedded search app marker missing on ${result.url}`);
    if (!html.includes('data-thc-search-runtime="embedded-v1"')) throw new Error(`Embedded search runtime missing on ${result.url}`);
    if (!html.includes('__THC_ENCYCLOPEDIA_INDEX__')) throw new Error(`Embedded encyclopedia payload missing on ${result.url}`);
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
  results,
}, null, 2));
