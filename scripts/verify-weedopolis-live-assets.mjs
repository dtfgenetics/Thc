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
  { path: 'trading.css', minBytes: 1000 },
  { path: 'production-interactions.css', minBytes: 1000, marker: 'env(safe-area-inset-bottom)' },
  { path: 'js/weedopolis-edition.js', minBytes: 3000 },
  { path: 'js/weedopolis-master-overrides.js', minBytes: 500 },
  { path: 'js/weedopolis-assets.js', minBytes: 1500 },
  { path: 'js/weedopolis-approved-decks.js', minBytes: 5000, marker: 'webReady' },
  { path: 'js/weedopolis-engine.js', minBytes: 7000 },
  { path: 'js/weedopolis-solvency.js', minBytes: 1000 },
  { path: 'js/weedopolis-trading.js', minBytes: 1000 },
  { path: 'js/weedopolis-ui.js', minBytes: 8000 },
  { path: 'js/weedopolis-mobile-turn-dock.js', minBytes: 1000 },
  { path: 'js/weedopolis-trade-ui.js', minBytes: 1000 },
];

const requiredHtmlMarkers = [
  '<title>Weedopolis: Strain City Edition | DTF Genetics</title>',
  'data-ui-standard="premium-responsive-shell-v1"',
  'data-art-standard="weedopolis-v1-master"',
  'data-art-status="v1-master-loaded"',
  'production-interactions.css',
  'id="propertyAssetChip">Property card</span>',
  'Board artwork, interactive spaces, player tokens, and property actions stay synchronized throughout the match.',
  'class="mobile-game-dock"',
  'id="mobileRollBtn"',
  'js/weedopolis-edition.js',
  'js/weedopolis-master-overrides.js',
  'js/weedopolis-assets.js',
  'js/weedopolis-approved-decks.js',
  'js/weedopolis-engine.js',
  'js/weedopolis-solvency.js',
  'js/weedopolis-trading.js',
  'js/weedopolis-ui.js',
  'js/weedopolis-mobile-turn-dock.js',
  'js/weedopolis-trade-ui.js',
];

const forbiddenHtmlMarkers = [
  'Gameplay uses the Weedopolis V1 square-board master as the visual authority.',
  'Verified V1 deed mapping',
  'Weedopolis V1 production master board',
];

function makeUrl(relative = '') {
  const url = new URL(`${basePath}${relative}`, site);
  url.searchParams.set('dtf_weedopolis_asset_audit', `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`);
  return url;
}

function isTransientNetworkError(error) {
  const code = error?.cause?.code || error?.code || '';
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) return true;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || error?.name === 'TypeError') return true;
  return /timeout|timed out|fetch failed|socket|network/i.test(String(error?.message || ''));
}

async function fetchStrict(relative, accept = '*/*') {
  let lastError = null;
  const label = relative || 'index.html';
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
          'User-Agent': 'DTFSeeds-Weedopolis-Live-Asset-Audit/2.0',
        },
      });

      if (response.status === 200) {
        if (response.headers.has('location')) throw new Error(`${label} returned a redirect location`);
        return response;
      }

      const transientHttp = response.status === 429 || response.status >= 500;
      if (!transientHttp) {
        throw new Error(`${label} returned deterministic HTTP ${response.status}`);
      }

      lastError = new Error(`${label} returned transient HTTP ${response.status}`);
      if (attempt < attempts) {
        console.warn(`${lastError.message}; retrying (${attempt}/${attempts}).`);
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      throw lastError;
    } catch (error) {
      if (/deterministic HTTP|redirect location/.test(String(error?.message || ''))) throw error;
      if (!isTransientNetworkError(error) && !/transient HTTP/.test(String(error?.message || ''))) throw error;
      lastError = error;
      if (attempt < attempts) {
        console.warn(`Transient ${label} fetch failure on attempt ${attempt}: ${error?.message || error}. Retrying.`);
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`Unable to fetch ${label}`);
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
for (const marker of forbiddenHtmlMarkers) {
  if (html.includes(marker)) throw new Error(`Weedopolis HTML still exposes retired production copy: ${marker}`);
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
