import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center';
const sourceRoot = join(process.cwd(), 'site/public-route-patch/learn');

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Publisher/1.0' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-pages-${stamp}`);
await mkdir(backupDir, { recursive: true });

const routes = [
  { slug: 'library', title: 'Teaching Healthy Cultivation Education Library' },
  { slug: 'encyclopedia', title: 'THC Plant Science Encyclopedia' },
  { slug: 'academy', title: 'THC Academy' },
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

for (const result of results) {
  let html = '';
  let ok = false;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await fetch(`${result.url}?dtf_learning=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'User-Agent': 'DTFSeeds-Learning-Publisher/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    });
    html = await response.text();
    if (response.ok && html.includes('Teaching Healthy Cultivation') && html.includes('/learn/infographics/')) {
      ok = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!ok) throw new Error(`Visitor-facing verification failed for ${result.url}`);
  for (const forbidden of ['email@email.com', '+123456789']) {
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
