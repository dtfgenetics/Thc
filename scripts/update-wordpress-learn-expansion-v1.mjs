import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { inspectLearningPublicHtml, publicSemantics, publicRoutes } from './learning-public-semantics.mjs';

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const convergenceAttempts = positiveInteger(process.env.LEARNING_ROOT_CONVERGENCE_ATTEMPTS, 12);
const convergenceDelayMs = positiveInteger(process.env.LEARNING_ROOT_CONVERGENCE_DELAY_MS, 5000);
const convergenceHtmlPath = process.env.LEARNING_CONVERGENCE_HTML_PATH
  || `${process.env.RUNNER_TEMP || '/tmp'}/live-learn-convergence.html`;

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
    await writeFile(convergenceHtmlPath, html, 'utf8');
    lastStatus = response.status;
    lastBytes = html.length;
    const observed = inspectLearningPublicHtml(html);
    missingSemantics = observed.missingSemantics;
    missingRoutes = observed.missingRoutes;
    if (response.ok && observed.ok) {
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
  throw new Error(`Canonical Learning Experience V3 visitor semantics did not converge (lastStatus=${lastStatus}, lastBytes=${lastBytes}, missingSemantics=${JSON.stringify(missingSemantics)}, missingRoutes=${JSON.stringify(missingRoutes)}, evidence=${convergenceHtmlPath}).`);
}

console.log(JSON.stringify({
  pageId: pages[0].id,
  canonicalOwner: 'Learning Experience V3',
  mutation: 'none',
  storedVerification: 'success',
  publicVerification: 'semantic-cache-convergence',
  semanticNormalization: 'html-entity-decoded',
  convergenceAttempts,
  convergenceDelayMs,
  convergenceHtmlPath,
  routes,
  publicSemantics,
  publicRoutes,
  liveVerification: 'success'
}, null, 2));
