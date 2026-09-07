import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const siteUrl = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const cacheTag = process.env.GITHUB_RUN_ID || Date.now();

function readPin(path) {
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    assert.ok(index > 0, `Malformed source pin: ${line}`);
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

const candidates = [
  {
    id: 'ganjumanji',
    route: '/games/ganjumanji/',
    title: 'Ganjumanji',
    readySelector: '#game canvas',
    pin: readPin('site/public-route-patch/games/ganjumanji/source-revision.txt'),
    expectedRelease: { route: '/games/ganjumanji/', status: 'release-candidate' }
  },
  {
    id: 'thc-rpg',
    route: '/games/thc-rpg/',
    title: 'THC RPG',
    readySelector: '#startBtn',
    pin: readPin('site/public-route-patch/games/thc-rpg/source-revision.txt'),
    expectedRelease: { route: '/games/thc-rpg/', runtime: 'static-es-modules', status: 'release-candidate', saveVersion: 6 }
  }
];

async function fetchNoRedirect(path) {
  const response = await fetch(`${siteUrl}${path}${path.includes('?') ? '&' : '?'}dtf_external_verify=${cacheTag}`, {
    redirect: 'manual',
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    signal: AbortSignal.timeout(30_000)
  });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  assert.ok(!response.headers.get('location'), `${path} unexpectedly redirected`);
  return response;
}

for (const candidate of candidates) {
  const pageResponse = await fetchNoRedirect(candidate.route);
  const html = await pageResponse.text();
  assert.match(html, new RegExp(candidate.title, 'i'), `${candidate.id} title marker missing from live route`);

  const releaseResponse = await fetchNoRedirect(`${candidate.route}game-release.json`);
  const release = await releaseResponse.json();
  for (const [key, value] of Object.entries(candidate.expectedRelease)) {
    assert.deepEqual(release[key], value, `${candidate.id} live game-release ${key} mismatch`);
  }

  const pinResponse = await fetchNoRedirect(`${candidate.route}source-revision.txt`);
  const livePinText = await pinResponse.text();
  assert.match(livePinText, new RegExp(`commit=${candidate.pin.commit}`), `${candidate.id} live source revision mismatch`);
  assert.match(livePinText, new RegExp(`repository=${candidate.pin.repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${candidate.id} live repository pin mismatch`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const candidate of candidates) {
    for (const [name, viewport] of [
      ['desktop', { width: 1280, height: 820 }],
      ['mobile', { width: 390, height: 844 }]
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      const failed = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));

      const response = await page.goto(`${siteUrl}${candidate.route}?dtf_external_browser=${cacheTag}-${name}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000
      });
      assert.ok(response, `${candidate.id} ${name} produced no navigation response`);
      assert.equal(response.status(), 200, `${candidate.id} ${name} returned HTTP ${response.status()}`);
      assert.equal(new URL(page.url()).pathname, candidate.route, `${candidate.id} ${name} redirected away from canonical route`);
      await page.waitForSelector(candidate.readySelector, { state: 'visible', timeout: 20_000 });
      assert.equal(errors.length, 0, `${candidate.id} ${name} browser errors: ${errors.join(' | ')}`);
      assert.equal(failed.length, 0, `${candidate.id} ${name} failed requests: ${failed.join(' | ')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  ok: true,
  siteUrl,
  candidates: candidates.map(({ id, route, pin }) => ({ id, route, commit: pin.commit })),
  viewports: ['desktop', 'mobile']
}, null, 2));
