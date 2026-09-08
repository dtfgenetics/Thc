import assert from 'node:assert/strict';
import fs from 'node:fs';

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
    id: 'ganjumanji', route: '/games/ganjumanji/', title: 'Ganjumanji',
    pin: readPin('site/public-route-patch/games/ganjumanji/source-revision.txt'),
    expectedRelease: { route: '/games/ganjumanji/', status: 'release-candidate' }
  },
  {
    id: 'thc-rpg', route: '/games/thc-rpg/', title: 'THC RPG',
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

  const scriptRefs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const styleRefs = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of [...scriptRefs, ...styleRefs]) {
    if (/^(?:https?:)?\/\//i.test(ref) || ref.startsWith('data:')) continue;
    const asset = new URL(ref, `${siteUrl}${candidate.route}`).pathname;
    await fetchNoRedirect(asset);
  }
  console.log(`${candidate.id}: live route, release metadata, source pin, and local asset references passed.`);
}

console.log('External release candidate HTTP/static verification passed.');
