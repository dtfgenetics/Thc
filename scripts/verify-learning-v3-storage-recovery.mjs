import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Storage-Recovery/1.0' };

async function get(path) {
  const response = await fetch(`${siteUrl}${path}`, { headers, redirect: 'follow', signal: AbortSignal.timeout(45_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

async function uniqueRoot(slug) {
  const pages = await get(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  const roots = (Array.isArray(pages) ? pages : []).filter((page) => Number(page.parent || 0) === 0);
  if (roots.length !== 1) throw new Error(`Expected one published root owner for ${slug}, found ${roots.length}`);
  return roots[0];
}

const home = await uniqueRoot('home');
const learn = await uniqueRoot('learn');
const homeContent = raw(home.content);
const learnContent = raw(learn.content);

const requirements = [
  ['Home V3 marker', homeContent.includes('data-dtf-layout="home-v3"')],
  ['Learn V3 marker', learnContent.includes('data-dtf-layout="learn-v3"')],
  ['Learn Atlas route', learnContent.includes('/learn/atlas/')],
  ['Learn Atlas CTA', learnContent.includes('Open the THC Living Plant Atlas')],
  ['Learn Start Here route', learnContent.includes('/learn/start-here/')],
];
for (const [label, ok] of requirements) if (!ok) throw new Error(`${label} is missing from stored canonical WordPress content`);

if (Number(home.id) !== Number((await get('/wp-json/wp/v2/settings?context=edit')).page_on_front || 0)) {
  throw new Error(`Stored Home owner ${home.id} is not configured as page_on_front`);
}

console.log(JSON.stringify({
  ok: true,
  home: { id: home.id, slug: home.slug, bytes: Buffer.byteLength(homeContent, 'utf8'), homeV3: true },
  learn: { id: learn.id, slug: learn.slug, bytes: Buffer.byteLength(learnContent, 'utf8'), learnV3: true, atlasCta: true },
}, null, 2));
