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
const publicRequiredText = [
  'Learn in a sequence that makes the plant easier to understand.',
  'Learn the plant as a connected system.',
  'Plant Health & IPM',
  'Cultivation Science',
  'Symptom Differentials',
  'Printable Field Tools',
  'Evidence & Sources'
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// This compatibility step intentionally performs no WordPress mutation.
// Learning Experience V3 is the sole automatic writer for /learn/. The
// education-expansion workflow publishes child pages, confirms the stored Learn
// page is still the canonical V3 owner, then verifies the visitor-facing owner
// exposes stable semantic labels and links to those already-published children.
const storedResponse = await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10`, {
  headers: { Authorization: auth, Accept: 'application/json', 'User-Agent': 'DTFSeeds-Learn-Expansion-Ownership-Check/3.0' },
  redirect: 'follow',
  signal: AbortSignal.timeout(60_000)
});
if (!storedResponse.ok) throw new Error(`Could not inspect canonical Learn owner (${storedResponse.status})`);
const pages = await storedResponse.json();
if (!Array.isArray(pages) || pages.length !== 1) {
  throw new Error(`Expected exactly one Learn page, found ${Array.isArray(pages) ? pages.length : 'invalid response'}`);
}

const storedHtml = String(pages[0]?.content?.raw || pages[0]?.content?.rendered || '');
const storedOwnerChecks = [
  /data-dtf-layout=["']learn-v3["']/i,
  /Learn in a sequence that makes the plant easier to understand\./i
];
if (!storedOwnerChecks.every((pattern) => pattern.test(storedHtml))) {
  throw new Error('Stored Learn page no longer matches the canonical Learning Experience V3 owner contract.');
}

let verified = false;
let lastStatus = 0;
let lastBytes = 0;
let lastMissingText = [...publicRequiredText];
let lastMissingRoutes = [...routes];
for (let attempt = 1; attempt <= 36; attempt += 1) {
  try {
    const response = await fetch(`${siteUrl}/learn/?dtf_expansion_owner=${Date.now()}-${attempt}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    const html = await response.text();
    lastStatus = response.status;
    lastBytes = html.length;
    lastMissingText = publicRequiredText.filter((marker) => !html.includes(marker));
    lastMissingRoutes = routes.filter((href) => !html.includes(href));
    if (response.ok && lastMissingText.length === 0 && lastMissingRoutes.length === 0) {
      verified = true;
      break;
    }
  } catch (error) {
    console.warn(`Learn-owner convergence check ${attempt} failed transiently: ${error?.message || error}`);
  }
  await sleep(5000);
}

if (!verified) {
  throw new Error(
    `Canonical Learning Experience V3 did not expose the education expansion contract in time ` +
    `(lastStatus=${lastStatus}, lastBytes=${lastBytes}, missingText=${JSON.stringify(lastMissingText)}, ` +
    `missingRoutes=${JSON.stringify(lastMissingRoutes)}).`
  );
}

console.log(JSON.stringify({
  pageId: pages[0].id,
  canonicalOwner: 'Learning Experience V3',
  mutation: 'none',
  routes,
  publicRequiredText,
  liveVerification: 'success'
}, null, 2));
