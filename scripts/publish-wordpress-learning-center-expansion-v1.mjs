import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-learning-center-expansion';
const sourceRoot = join(process.cwd(), 'site/public-route-patch/learn');
const sourceMarker = 'DTF-PUBLIC-LEARNING-EXPANSION-V1';
const publicMarker = 'Source-controlled release';

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Expansion-Publisher/1.1' };
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `learning-expansion-${stamp}`);
await mkdir(backupDir, { recursive: true });

const routes = [
  { slug: 'plant-health', title: 'Plant Health, Disease, Pests & IPM' },
  { slug: 'cultivation-science', title: 'Cultivation Science Reference Library' },
  { slug: 'symptoms', title: 'Symptom Differential Library' },
  { slug: 'tools', title: 'THC Printable Field Tools & Worksheets' },
  { slug: 'sources', title: 'THC Evidence & Research Sources' }
];

const forbiddenStrings = [
  'email@email.com',
  '+123456789',
  'being rebuilt',
  'Needed from owner',
  'Mystery_Line_F1_Regular_DTF_Strain_Card',
  'Rainbow_Bubblegum_F1_Regular_DTF_Strain_Card'
];

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
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
  return `${style}\n<!-- ${sourceMarker} -->\n${main}`;
}

function rawContent(page) {
  if (!page || !page.content) return '';
  if (typeof page.content.raw === 'string') return page.content.raw;
  if (typeof page.content.rendered === 'string') return page.content.rendered;
  return '';
}

function assertStoredPage(page, route, learnId) {
  if (!page || !page.id) throw new Error(`WordPress did not return a valid page for ${route.slug}`);
  if (page.status !== 'publish') throw new Error(`WordPress page ${page.id} for ${route.slug} is not published (status=${page.status})`);
  if (Number(page.parent) !== Number(learnId)) throw new Error(`WordPress page ${page.id} for ${route.slug} is not a child of Learn (${learnId})`);
  if (page.slug !== route.slug) throw new Error(`WordPress page ${page.id} slug drift: expected ${route.slug}, got ${page.slug}`);
  const expectedPath = `/learn/${route.slug}/`;
  const link = String(page.link || '');
  if (!link.endsWith(expectedPath)) throw new Error(`WordPress page ${page.id} permalink drift: expected ${expectedPath}, got ${link || 'missing link'}`);
  const stored = rawContent(page);
  if (!stored.includes(sourceMarker)) throw new Error(`WordPress page ${page.id} is missing source marker after write`);
  if (!stored.includes('Teaching Healthy Cultivation')) throw new Error(`WordPress page ${page.id} is missing THC identity after write`);
  if (!stored.includes(publicMarker)) throw new Error(`WordPress page ${page.id} is missing visible release marker after write`);
  for (const forbidden of forbiddenStrings) {
    if (stored.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Forbidden/stale content stored on WordPress page ${page.id}: ${forbidden}`);
  }
}

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if (!Array.isArray(learnRows) || learnRows.length !== 1) throw new Error(`Expected exactly one Learn parent page, found ${Array.isArray(learnRows) ? learnRows.length : 'invalid response'}`);
const learn = learnRows[0];
const results = [];

for (const route of routes) {
  const html = await readFile(join(sourceRoot, route.slug, 'index.html'), 'utf8');
  const content = sourceContent(html);
  if (!content.includes(publicMarker)) throw new Error(`Generated ${route.slug} page is missing visible release marker`);
  const candidates = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(route.slug)}&context=edit&per_page=100`);
  const children = Array.isArray(candidates) ? candidates.filter((page) => Number(page.parent) === Number(learn.id)) : [];
  if (children.length > 1) throw new Error(`Multiple /learn/${route.slug}/ child pages exist; refusing ambiguous update.`);

  let page = children[0] || null;
  if (page) {
    await writeFile(join(backupDir, `page-${page.id}-${route.slug}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
    page = await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`, {
      method: 'POST',
      body: JSON.stringify({ title: route.title, slug: route.slug, parent: learn.id, content, status: 'publish' })
    });
    assertStoredPage(page, route, learn.id);
    results.push({ slug: route.slug, id: page.id, action: 'updated', url: `${siteUrl}/learn/${route.slug}/` });
  } else {
    page = await request('/wp-json/wp/v2/pages?context=edit', {
      method: 'POST',
      body: JSON.stringify({ title: route.title, slug: route.slug, parent: learn.id, content, status: 'publish' })
    });
    assertStoredPage(page, route, learn.id);
    await writeFile(join(backupDir, `page-${page.id}-${route.slug}-created.json`), `${JSON.stringify(page, null, 2)}\n`);
    results.push({ slug: route.slug, id: page.id, action: 'created', url: `${siteUrl}/learn/${route.slug}/` });
  }
}

for (const result of results) {
  let ok = false;
  let html = '';
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 12; attempt++) {
    const response = await fetch(`${result.url}?dtf_expansion=${Date.now()}-${attempt}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Learning-Expansion-Publisher/1.1'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    lastStatus = response.status;
    html = await response.text();
    if (response.ok && html.includes('Teaching Healthy Cultivation') && html.includes(publicMarker)) {
      ok = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!ok) {
    const observed = {
      url: result.url,
      status: lastStatus,
      hasThcIdentity: html.includes('Teaching Healthy Cultivation'),
      hasPublicMarker: html.includes(publicMarker),
      hasSourceCommentMarker: html.includes(sourceMarker),
      bodyLength: html.length
    };
    await writeFile(join(backupDir, `visitor-verification-${result.slug}-failure.json`), `${JSON.stringify(observed, null, 2)}\n`);
    throw new Error(`Visitor-facing verification failed for ${result.url}: ${JSON.stringify(observed)}`);
  }
  for (const forbidden of forbiddenStrings) {
    if (html.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Forbidden/stale content found on ${result.url}: ${forbidden}`);
  }
}

await writeFile(join(backupDir, 'publish-result.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), learnParentId: learn.id, results }, null, 2)}\n`);
console.log(JSON.stringify({ learnParentId: learn.id, backupDir, results, verified: results.length }, null, 2));
