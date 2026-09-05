import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const routes = [
  '/learn/plant-health/',
  '/learn/cultivation-science/',
  '/learn/symptoms/',
  '/learn/tools/',
  '/learn/sources/'
];
const storedMarkers = [
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  'data-dtf-learning-expanded-reference="v1"',
  '/learn/atlas/',
  'Open the THC Living Plant Atlas'
];
const publicSemantics = [
  'Teaching Healthy Cultivation',
  'Learn in a sequence that makes the plant easier to understand.',
  'Open the THC Living Plant Atlas',
  'See how the systems connect before you go deep.',
  'Learn the plant as a connected system.',
  'Plant Health & IPM',
  'Cultivation Science',
  'Symptom Differentials',
  'Printable Field Tools',
  'Evidence & Sources'
];
const publicRoutes = ['/learn/atlas/', ...routes];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeHtmlEntity(entity) {
  const normalized = String(entity || '').toLowerCase();
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  if (Object.prototype.hasOwnProperty.call(named, normalized)) return named[normalized];

  const radix = normalized.startsWith('#x') ? 16 : 10;
  const numeric = normalized.startsWith('#x') ? normalized.slice(2) : normalized.startsWith('#') ? normalized.slice(1) : '';
  if (numeric) {
    const codePoint = Number.parseInt(numeric, radix);
    if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
      return String.fromCodePoint(codePoint);
    }
  }

  return `&${entity};`;
}

function normalizeVisitorText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity) => decodeHtmlEntity(entity))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const convergenceAttempts = positiveInteger(process.env.LEARNING_ROOT_CONVERGENCE_ATTEMPTS, 12);
const convergenceDelayMs = positiveInteger(process.env.LEARNING_ROOT_CONVERGENCE_DELAY_MS, 5000);

function storedContent(page) {
  if (typeof page?.content?.raw === 'string') return page.content.raw;
  if (typeof page?.content?.rendered === 'string') return page.content.rendered;
  return '';
}

// This compatibility step intentionally performs no WordPress mutation.
// Learning Experience V3 is the sole automatic writer for /learn/. The
// education-expansion workflow publishes child pages, then waits until the
// canonical Learn owner has both the required stored owner state and the
// stable visitor-facing semantics for those already-published children.
const storedResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10`, {
  headers: { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learn-Expansion-Ownership-Check/2.2' },
  redirect: 'follow',
  signal: AbortSignal.timeout(60_000)
});
if (!storedResponse.ok) throw new Error(`Could not inspect canonical Learn owner (${storedResponse.status})`);
const pages = await storedResponse.json();
if (!Array.isArray(pages) || pages.length !== 1) {
  throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
}

const stored = storedContent(pages[0]);
const missingStored = storedMarkers.filter((marker) => !stored.includes(marker));
if (missingStored.length) {
  throw new Error(`Canonical Learn owner is missing stored markers: ${missingStored.join(', ')}`);
}

let verified = false;
let lastStatus = 0;
let lastBytes = 0;
let missingSemantics = [...publicSemantics];
let missingRoutes = [...publicRoutes];
for (let attempt = 1; attempt <= convergenceAttempts; attempt += 1) {
  try {
    const response = await fetch(`${siteUrl}/learn/?dtf_expansion_owner=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    const html = await response.text();
    const normalizedHtml = normalizeVisitorText(html);
    lastStatus = response.status;
    lastBytes = html.length;
    missingSemantics = publicSemantics.filter((marker) => !normalizedHtml.includes(normalizeVisitorText(marker)));
    missingRoutes = publicRoutes.filter((href) => !html.includes(href));
    if (response.ok && missingSemantics.length === 0 && missingRoutes.length === 0) {
      verified = true;
      console.log(`Learn visitor semantics converged on attempt ${attempt}/${convergenceAttempts}.`);
      break;
    }
    console.warn(`Learn visitor semantics not converged on attempt ${attempt}/${convergenceAttempts}; missingSemantics=${JSON.stringify(missingSemantics)}, missingRoutes=${JSON.stringify(missingRoutes)}`);
  } catch (error) {
    console.warn(`Learn-owner convergence check ${attempt}/${convergenceAttempts} failed transiently: ${error?.message || error}`);
  }
  if (attempt < convergenceAttempts) await sleep(convergenceDelayMs);
}

if (!verified) {
  throw new Error(`Canonical Learning Experience V3 visitor semantics did not converge (lastStatus=${lastStatus}, lastBytes=${lastBytes}, missingSemantics=${JSON.stringify(missingSemantics)}, missingRoutes=${JSON.stringify(missingRoutes)}).`);
}

console.log(JSON.stringify({
  pageId: pages[0].id,
  canonicalOwner: 'Learning Experience V3',
  mutation: 'none',
  storedVerification: 'success',
  publicVerification: 'semantic-cache-convergence',
  semanticNormalization: 'visible-text-html-entities',
  convergenceAttempts,
  convergenceDelayMs,
  routes,
  publicSemantics,
  liveVerification: 'success'
}, null, 2));
