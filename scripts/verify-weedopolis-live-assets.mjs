#!/usr/bin/env node
import dns from 'node:dns';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const site = String(process.env.SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const basePath = '/games/weedopolis/';
const attempts = Number(process.env.WEEDOPOLIS_VERIFY_ATTEMPTS || 4);
const timeoutMs = Number(process.env.WEEDOPOLIS_VERIFY_TIMEOUT_MS || 45000);

const textAssets = [
  { path: 'styles.css', minBytes: 4000 },
  { path: 'approved-assets.css', minBytes: 5000 },
  { path: 'runtime-assets.css', minBytes: 500 },
  { path: 'master-board-overlay.css', minBytes: 800, marker: 'assets/board/weedopolis-master-board.webp' },
  { path: 'js/weedopolis-edition.js', minBytes: 3000 },
  { path: 'js/weedopolis-master-overrides.js', minBytes: 500 },
  { path: 'js/weedopolis-assets.js', minBytes: 1500 },
  { path: 'js/weedopolis-approved-decks.js', minBytes: 5000, marker: 'webReady' },
  { path: 'js/weedopolis-engine.js', minBytes: 7000 },
  { path: 'js/weedopolis-ui.js', minBytes: 8000 },
  { path: 'js/weedopolis-tests.js', minBytes: 1000 },
];

const requiredHtmlMarkers = [
  '<title>Weedopolis: Strain City Edition | DTF Genetics</title>',
  'data-ui-standard="premium-responsive-shell-v1"',
  'data-art-standard="weedopolis-v1-master"',
  'data-art-status="v1-master-loaded"',
  'styles.css',
  'approved-assets.css',
  'runtime-assets.css',
  'master-board-overlay.css',
  'js/weedopolis-edition.js',
  'js/weedopolis-master-overrides.js',
  'js/weedopolis-assets.js',
  'js/weedopolis-approved-decks.js',
  'js/weedopolis-engine.js',
  'js/weedopolis-ui.js',
  'js/weedopolis-tests.js',
];

function makeUrl(relative = '') {
  const url = new URL(`${basePath}${relative}`, site);
  url.searchParams.set('dtf_weedopolis_asset_audit', `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`);
  return url;
}

async function fetchStrict(relative, accept = '*/*') {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const url = makeUrl(relative);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: accept,
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Weedopolis-Live-Asset-Audit/1.0',
        },
      });
      if (response.status !== 200) throw new Error(`${relative || 'index.html'} returned HTTP ${response.status}`);
      if (response.headers.has('location')) throw new Error(`${relative || 'index.html'} returned a redirect location`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`Unable to fetch ${relative || 'index.html'}`);
}

async function verifyWebp(path, minBytes, label) {
  const response = await fetchStrict(path, 'image/webp,image/*;q=0.8,*/*;q=0.1');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < minBytes) throw new Error(`${label} is unexpectedly small: ${bytes.length} bytes`);
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error(`${label} failed RIFF/WEBP signature validation`);
  }
  results.push({ asset: path, bytes: bytes.length, ok: true, format: 'WEBP' });
}

const results = [];

const htmlResponse = await fetchStrict('', 'text/html');
const html = await htmlResponse.text();
const htmlBytes = Buffer.byteLength(html);
if (htmlBytes < 5000) throw new Error(`Weedopolis HTML is unexpectedly small: ${htmlBytes} bytes`);
for (const marker of requiredHtmlMarkers) {
  if (!html.includes(marker)) throw new Error(`Weedopolis HTML missing required marker: ${marker}`);
}
results.push({ asset: 'index.html', bytes: htmlBytes, ok: true });

for (const asset of textAssets) {
  const response = await fetchStrict(asset.path, asset.path.endsWith('.css') ? 'text/css,*/*;q=0.1' : 'text/javascript,*/*;q=0.1');
  const text = await response.text();
  const bytes = Buffer.byteLength(text);
  if (bytes < asset.minBytes) throw new Error(`${asset.path} is unexpectedly small: ${bytes} < ${asset.minBytes}`);
  if (asset.marker && !text.includes(asset.marker)) throw new Error(`${asset.path} missing required marker: ${asset.marker}`);
  results.push({ asset: asset.path, bytes, ok: true });
}

await verifyWebp('assets/board/weedopolis-master-board.webp', 30000, 'Master board');
await verifyWebp('assets/property-cards/webp/autoflower.webp', 39000, 'AutoFlower ownership card');
await verifyWebp('assets/decks/high-chance/high-chance-01.webp', 15000, 'High Chance #1 approved card');

console.log(JSON.stringify({
  ok: true,
  site,
  route: basePath,
  assetsVerified: results.length,
  results,
}, null, 2));
