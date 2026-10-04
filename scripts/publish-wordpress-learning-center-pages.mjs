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

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function searchFallbackHtml() {
  const rows = (searchIndex.documents || []).slice(0, 30);
  const cards = rows.map((item) => `<article class="search-card" data-dtf-server-fallback="search"><div class="search-meta"><span>${esc(item.type || 'Reference')}</span><code>${esc(item.id || '')}</code></div><h2><a href="${esc(item.route)}">${esc(item.title)}</a></h2><p>${esc(item.summary || '')}</p><div class="search-keywords">${(item.keywords || []).slice(0, 6).map((keyword) => `<span>${esc(keyword)}</span>`).join('')}</div><a class="open-link" href="${esc(item.route)}">Open resource →</a></article>`).join('');
  return {
    status: `${searchIndex.documents?.length || 0} education resources indexed · interactive search loads when JavaScript is available`,
    cards: cards || '<div class="empty"><strong>Education index is available through the Learning Center.</strong></div>',
  };
}

function encyclopediaFallbackHtml() {
  const lessons = Array.isArray(encyclopediaIndex.lessons) ? encyclopediaIndex.lessons : [];
  const topics = Array.isArray(encyclopediaIndex.topics) ? encyclopediaIndex.topics : [];
  const published = lessons.filter((item) => item.status === 'published');
  const cards = published.slice(0, 60).map((item) => `<article class="lesson" data-dtf-server-fallback="encyclopedia"><div class="lesson-top"><span class="id">${esc(item.id)}</span><span class="badge">Published</span></div><h3>${esc(item.title)}</h3><p>${esc(item.objective || ('Reference topic in ' + (item.topic || 'Plant Science') + '.'))}</p><div class="meta"><span>${esc(item.topic || '')}</span><span>${esc(item.primaryFormat || 'Reference')}</span></div><a href="${esc(item.route)}" aria-label="Open ${esc(item.id)} ${esc(item.title)}">Open lesson →</a></article>`).join('');
  const topicButtons = topics.map((topic) => `<button class="topic" type="button" data-part="${Number(topic.part)}" aria-pressed="false"><span class="topic-num">Part ${String(topic.part).padStart(2,'0')} · ${esc(topic.range?.[0] ?? '')}–${esc(topic.range?.[1] ?? '')}</span><h3>${esc(topic.title)}</h3><p>${esc(topic.description || '')}</p><div class="topic-meta">${Number(topic.publishedCount || 0)} published · ${Number(topic.count || 0)} registered</div></button>`).join('');
  const allLinks = published.map((item) => `<li><a href="${esc(item.route)}">${esc(item.id)} · ${esc(item.title)}</a></li>`).join('');
  const noscript = `<noscript><section aria-labelledby="dtf-encyclopedia-noscript"><h2 id="dtf-encyclopedia-noscript">All published encyclopedia lessons</h2><p>JavaScript adds fuzzy search and filters. Every published lesson remains directly available here.</p><ol>${allLinks}</ol></section></noscript>`;
  return {
    total: lessons.length,
    published: published.length,
    subjects: topics.length,
    status: `Showing 60 of ${published.length} published entries · ${lessons.length} total registered`,
    cards,
    topicButtons,
    noscript,
  };
}

function sourceContent(html, slug) {
  const style = extract(html, /(<style>[\s\S]*?<\/style>)/i, 'style block');
  let main = extract(html, /<main[^>]*>([\s\S]*?)<\/main>/i, 'main content');
  if (slug === 'search') {
    const fallback = searchFallbackHtml();
    main = main
      .replace('Loading education index…', fallback.status)
      .replace('<section class="grid" data-search-results aria-label="Search results"></section>', `<section class="grid" data-search-results aria-label="Search results">${fallback.cards}</section>`);
  }
  if (slug === 'encyclopedia') {
    const fallback = encyclopediaFallbackHtml();
    main = main
      .replace(/<b data-stat-total>—<\/b>/g, `<b data-stat-total>${fallback.total}</b>`)
      .replace(/<b data-stat-published>—<\/b>/g, `<b data-stat-published>${fallback.published}</b>`)
      .replace(/<b data-stat-subjects>—<\/b>/g, `<b data-stat-subjects>${fallback.subjects}</b>`)
      .replace(/<b data-stat-visible>—<\/b>/g, `<b data-stat-visible>${Math.min(60, fallback.published)}</b>`)
      .replace('Loading encyclopedia index…', fallback.status)
      .replace('<span data-subject-count>—</span>', `<span data-subject-count>${fallback.subjects}</span>`)
      .replace('<div class="topics" data-topics></div>', `<div class="topics" data-topics>${fallback.topicButtons}</div>`)
      .replace('<div class="library" data-library aria-busy="true"></div>', `<div class="library" data-library aria-busy="false">${fallback.cards}</div>${fallback.noscript}`);
  }
  return `${style}\n<!-- DTF-PUBLIC-LEARNING-PAGE --><!-- DTF-SERVER-SEARCH-FALLBACK -->\n${main}`;
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
