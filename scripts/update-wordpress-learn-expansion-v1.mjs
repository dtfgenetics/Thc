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
const requiredMarkers = [
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  'data-dtf-learning-expanded-reference="v1"',
  'Learn the plant as a connected system.'
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// This compatibility step intentionally performs no WordPress mutation.
// Learning Experience V3 is the sole automatic writer for /learn/. The
// education-expansion workflow publishes child pages, then waits until the
// canonical Learn owner exposes links to those already-published children.
const storedResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10`, {
  headers: { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learn-Expansion-Ownership-Check/2.0' },
  redirect: 'follow',
  signal: AbortSignal.timeout(60_000)
});
if (!storedResponse.ok) throw new Error(`Could not inspect canonical Learn owner (${storedResponse.status})`);
const pages = await storedResponse.json();
if (!Array.isArray(pages) || pages.length !== 1) {
  throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
}

let verified = false;
let lastStatus = 0;
let lastBytes = 0;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    const response = await fetch(`${siteUrl}/learn/?dtf_expansion_owner=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    const html = await response.text();
    lastStatus = response.status;
    lastBytes = html.length;
    if (response.ok && requiredMarkers.every((marker) => html.includes(marker)) && routes.every((href) => html.includes(href))) {
      verified = true;
      break;
    }
  } catch (error) {
    console.warn(`Learn-owner convergence check ${attempt} failed transiently: ${error?.message || error}`);
  }
  await sleep(5000);
}

if (!verified) {
  throw new Error(`Canonical Learning Experience V3 did not expose the education expansion routes in time (lastStatus=${lastStatus}, lastBytes=${lastBytes}).`);
}

console.log(JSON.stringify({
  pageId: pages[0].id,
  canonicalOwner: 'Learning Experience V3',
  mutation: 'none',
  routes,
  liveVerification: 'success'
}, null, 2));
