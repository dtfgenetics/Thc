import assert from 'node:assert/strict';

const siteUrl = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const version = process.env.DTF_GAME_PLATFORM_VERSION || '1.1.0';
const cacheTag = process.env.GITHUB_RUN_ID || Date.now();

async function fetchText(pathname, expectedType) {
  const url = `${siteUrl}${pathname}${pathname.includes('?') ? '&' : '?'}verify=${cacheTag}`;
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${pathname} returned HTTP ${response.status}`);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (expectedType) assert.match(contentType, expectedType, `${pathname} has invalid MIME type: ${contentType || '<missing>'}`);
  const body = await response.text();
  assert.ok(body.trim(), `${pathname} returned an empty body`);
  assert.doesNotMatch(body, /<!doctype html|<html/i, `${pathname} unexpectedly returned HTML`);
  return { body, contentType };
}

const manifestResponse = await fetch(`${siteUrl}/games/shared-platform/manifest.json?verify=${cacheTag}`, {
  headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000),
});
assert.equal(manifestResponse.status, 200, `shared platform manifest returned HTTP ${manifestResponse.status}`);
assert.match(String(manifestResponse.headers.get('content-type') || '').toLowerCase(), /application\/json/, 'shared platform manifest has invalid MIME type');
const manifest = await manifestResponse.json();
assert.equal(manifest.platformVersion, version, `manifest version ${manifest.platformVersion}; expected ${version}`);

const modules = ['index.mjs', 'settings.mjs', 'replay.mjs', 'telemetry.mjs', 'input.mjs', 'audio.mjs'];
const sources = new Map();
for (const file of modules) {
  const { body } = await fetchText(`/games/shared-platform/${file}`, /(javascript|ecmascript)/);
  sources.set(file, body);
}
const indexSource = sources.get('index.mjs');
assert.match(indexSource, /DTF_GAME_PLATFORM_VERSION/, 'shared platform index module marker is missing');
assert.match(indexSource, new RegExp(`DTF_GAME_PLATFORM_VERSION\\s*=\\s*['\"]${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`), `shared platform index does not declare version ${version}`);

const seedIndexResponse = await fetch(`${siteUrl}/games/seed-man-platformer/?shared_platform_verify=${cacheTag}`, {
  headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000),
});
assert.equal(seedIndexResponse.status, 200, `Seed Man route returned HTTP ${seedIndexResponse.status}`);
const seedIndex = await seedIndexResponse.text();
assert.match(seedIndex, /input-guard-v1\.js/, 'Seed Man page does not load the shared-platform adapter owner');

const inputGuardResponse = await fetch(`${siteUrl}/games/seed-man-platformer/input-guard-v1.js?shared_platform_verify=${cacheTag}`, {
  headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000),
});
assert.equal(inputGuardResponse.status, 200, `Seed Man input guard returned HTTP ${inputGuardResponse.status}`);
assert.match(String(inputGuardResponse.headers.get('content-type') || '').toLowerCase(), /(javascript|ecmascript)/, 'Seed Man input guard has invalid JavaScript MIME type');
const inputGuard = await inputGuardResponse.text();
for (const marker of ['/games/shared-platform/index.mjs', '__SPROUT_SHARED_PLATFORM__', 'seed-game-settings', 'seed-man-shared-platform-v1']) {
  assert.ok(inputGuard.includes(marker), `Seed Man shared-platform adapter marker missing: ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  route: '/games/shared-platform/',
  module: '/games/shared-platform/index.mjs',
  version,
  modules: modules.length,
  consumer: 'seed-man-shared-platform-v1',
  verification: 'deterministic-http-and-source-contracts',
  browserAutomation: false,
}, null, 2));
