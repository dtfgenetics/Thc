#!/usr/bin/env node
import dns from 'node:dns';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const site = String(process.env.SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const basePath = '/games/strain-showdown/';
const attempts = Number(process.env.STRAIN_SHOWDOWN_VERIFY_ATTEMPTS || 4);
const timeoutMs = Number(process.env.STRAIN_SHOWDOWN_VERIFY_TIMEOUT_MS || 45000);

const requiredHtmlMarkers = [
  '<title>Strain Showdown | DTF Genetics Game Hub</title>',
  'Eight play styles. One showdown.',
  'id="familyGrid"',
  'id="battleScreen"',
  'id="playerLanes"',
  'id="hand"',
  'id="resultOverlay"',
  'runtime-v2.css',
  'runtime-v3.css',
  'runtime-v4.css',
  'app.js',
];

const forbiddenHtmlMarkers = [
  'Battle Lab',
  'rules lab',
  'fake “finished” TCG',
  'experimental Tier 1 rules layer',
];

const textAssets = [
  { path: 'styles.css', minBytes: 10000 },
  { path: 'runtime-v2.css', minBytes: 3000 },
  { path: 'runtime-v3.css', minBytes: 1500, marker: 'grid-template-columns:repeat(3,minmax(0,1fr))' },
  { path: 'runtime-v4.css', minBytes: 1000, marker: 'min-height:44px' },
  { path: 'app.js', minBytes: 15000, marker: "fetch('./data/browser-bundle.json'" },
  { path: 'engine.mjs', minBytes: 8000 },
  { path: 'data/browser-bundle.json', minBytes: 15000, marker: '"cardCount":96' },
];

function makeUrl(relative = '') {
  const url = new URL(`${basePath}${relative}`, site);
  url.searchParams.set('dtf_strain_showdown_audit', `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`);
  return url;
}

async function fetchStrict(relative, accept = '*/*') {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    try {
      const response = await fetch(makeUrl(relative), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: accept,
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'DTFSeeds-Strain-Showdown-Live-Audit/1.0',
        },
      });
      if (response.status !== 200) throw new Error(`${relative || 'index.html'} returned HTTP ${response.status}`);
      if (response.headers.has('location')) throw new Error(`${relative || 'index.html'} returned a redirect`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`Unable to fetch ${relative || 'index.html'}`);
}

const results = [];
const htmlResponse = await fetchStrict('', 'text/html');
const html = await htmlResponse.text();
const htmlBytes = Buffer.byteLength(html);
if (htmlBytes < 6000) throw new Error(`Strain Showdown HTML is unexpectedly small: ${htmlBytes} bytes`);
for (const marker of requiredHtmlMarkers) {
  if (!html.includes(marker)) throw new Error(`Strain Showdown HTML missing required marker: ${marker}`);
}
for (const marker of forbiddenHtmlMarkers) {
  if (html.includes(marker)) throw new Error(`Strain Showdown still exposes retired player-facing copy: ${marker}`);
}
results.push({ asset: 'index.html', bytes: htmlBytes, ok: true });

for (const asset of textAssets) {
  const response = await fetchStrict(asset.path, asset.path.endsWith('.css') ? 'text/css,*/*;q=0.1' : asset.path.endsWith('.json') ? 'application/json,*/*;q=0.1' : 'text/javascript,*/*;q=0.1');
  const text = await response.text();
  const bytes = Buffer.byteLength(text);
  if (bytes < asset.minBytes) throw new Error(`${asset.path} is unexpectedly small: ${bytes} < ${asset.minBytes}`);
  if (asset.marker && !text.includes(asset.marker)) throw new Error(`${asset.path} missing required marker: ${asset.marker}`);
  results.push({ asset: asset.path, bytes, ok: true });
}

const bundleResponse = await fetchStrict('data/browser-bundle.json', 'application/json,*/*;q=0.1');
const bundle = await bundleResponse.json();
if (bundle.cardCount !== 96 || bundle.familyCount !== 8 || !Array.isArray(bundle.cards) || bundle.cards.length !== 96) {
  throw new Error(`Strain Showdown live bundle mismatch: cardCount=${bundle.cardCount}, familyCount=${bundle.familyCount}, cards=${bundle.cards?.length}`);
}
for (const family of ['kush', 'haze', 'skunk', 'gas', 'cookies', 'fruit', 'purple', 'frost']) {
  const count = bundle.cards.filter(card => card.family === family).length;
  if (count !== 12) throw new Error(`${family} live roster count mismatch: ${count}`);
}

console.log(JSON.stringify({
  ok: true,
  site,
  route: basePath,
  cardCount: bundle.cardCount,
  familyCount: bundle.familyCount,
  assetsVerified: results.length,
  results,
}, null, 2));
