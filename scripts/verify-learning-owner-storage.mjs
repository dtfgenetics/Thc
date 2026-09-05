import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const stage = String(process.env.LEARNING_OWNER_STAGE || 'v3').toLowerCase();
const validStages = new Set(['v3', 'v4', 'expanded', 'visual']);
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
if (!validStages.has(stage)) throw new Error(`Unsupported LEARNING_OWNER_STAGE: ${stage}`);

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learning-Owner-Storage/1.0' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(path) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, { headers, redirect: 'follow', signal: AbortSignal.timeout(45_000) });
      const text = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt < 5) {
        await sleep(1200 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${text.slice(0, 500)}`);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

function raw(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

async function uniqueRoot(slug) {
  const pages = await get(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100`);
  const roots = (Array.isArray(pages) ? pages : []).filter(page => Number(page.parent || 0) === 0);
  if (roots.length !== 1) throw new Error(`Expected one published root owner for ${slug}, found ${roots.length}`);
  return roots[0];
}

const home = await uniqueRoot('home');
const learn = await uniqueRoot('learn');
const homeContent = raw(home.content);
const learnContent = raw(learn.content);
const settings = await get('/wp-json/wp/v2/settings?context=edit');

if (Number(settings?.page_on_front || 0) !== Number(home.id)) {
  throw new Error(`Stored Home owner ${home.id} is not configured as page_on_front`);
}

const requirements = [
  ['Home V3 marker', homeContent, 'data-dtf-layout="home-v3"'],
  ['Learn V3 marker', learnContent, 'data-dtf-layout="learn-v3"'],
  ['Learn Start Here route', learnContent, '/learn/start-here/'],
  ['Learn Atlas route', learnContent, '/learn/atlas/'],
  ['Learn Atlas CTA', learnContent, 'Open the THC Living Plant Atlas']
];

if (['v4', 'expanded', 'visual'].includes(stage)) {
  requirements.push(
    ['Learn V4 marker', learnContent, 'data-dtf-learning-map="v4"'],
    ['Learn V4 heading', learnContent, 'See how the systems connect before you go deep.']
  );
}

if (['expanded', 'visual'].includes(stage)) {
  requirements.push(
    ['Expanded reference marker', learnContent, 'data-dtf-learning-expanded-reference="v1"'],
    ['Expanded reference ownership phrase', learnContent, 'Learn the plant as a connected system.'],
    ['Plant Health reference route', learnContent, '/learn/plant-health/'],
    ['Cultivation Science reference route', learnContent, '/learn/cultivation-science/'],
    ['Symptoms reference route', learnContent, '/learn/symptoms/'],
    ['Tools reference route', learnContent, '/learn/tools/'],
    ['Sources reference route', learnContent, '/learn/sources/']
  );
}

if (stage === 'visual') {
  requirements.push(
    ['Home visual marker', homeContent, 'data-dtf-visual="v1"'],
    ['Learn visual marker', learnContent, 'data-dtf-visual="v1"'],
    ['Home shared visual style', homeContent, 'dtf-visual-v1-shared'],
    ['Learn shared visual style', learnContent, 'dtf-visual-v1-shared'],
    ['Home Learning owner bridge style', homeContent, 'dtf-learning-owner-v1'],
    ['Learn Learning owner bridge style', learnContent, 'dtf-learning-owner-v1']
  );
}

const missing = requirements.filter(([, content, marker]) => !content.includes(marker)).map(([label,, marker]) => ({ label, marker }));
if (missing.length) throw new Error(`Stored Learning owner verification failed at ${stage}: ${JSON.stringify(missing)}`);

console.log(JSON.stringify({
  ok: true,
  verification: 'wordpress-rest-storage',
  stage,
  home: { id: home.id, status: home.status, bytes: Buffer.byteLength(homeContent, 'utf8') },
  learn: { id: learn.id, status: learn.status, bytes: Buffer.byteLength(learnContent, 'utf8') },
  requirementCount: requirements.length
}, null, 2));
