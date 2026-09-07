import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const siteUrl = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const version = process.env.DTF_GAME_PLATFORM_VERSION || '1.1.0';
const cacheTag = process.env.GITHUB_RUN_ID || Date.now();
const moduleUrl = `${siteUrl}/games/shared-platform/index.mjs?verify=${cacheTag}`;

const moduleResponse = await fetch(moduleUrl, {
  headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
  redirect: 'follow',
  signal: AbortSignal.timeout(30_000),
});
assert.equal(moduleResponse.status, 200, `shared platform module returned HTTP ${moduleResponse.status}`);
const contentType = String(moduleResponse.headers.get('content-type') || '').toLowerCase();
assert.match(contentType, /(javascript|ecmascript)/, `shared platform module has invalid MIME type: ${contentType || '<missing>'}`);
const source = await moduleResponse.text();
assert.match(source, /DTF_GAME_PLATFORM_VERSION/, 'shared platform index module marker is missing');
assert.doesNotMatch(source, /<!doctype html|<html/i, 'shared platform module URL returned HTML');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${siteUrl}/games/seed-man-platformer/?shared_platform_verify=${cacheTag}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const result = await page.evaluate(async ({ cacheTag: tag }) => {
    const module = await import(`/games/shared-platform/index.mjs?browser_verify=${tag}`);
    const storage = new Map();
    const fakeStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    };
    const store = module.createGameSettingsStore({ gameId: 'live-verifier', storage: fakeStorage });
    store.update({ reducedMotion: 'on', uiScale: 1.2, muted: true });
    const settings = store.get();
    return {
      version: module.DTF_GAME_PLATFORM_VERSION,
      reducedMotion: settings.reducedMotion,
      uiScale: settings.uiScale,
      muted: settings.muted,
      exportCount: Object.keys(module).length,
    };
  }, { cacheTag });

  assert.equal(result.version, version, `browser loaded shared platform ${result.version}; expected ${version}`);
  assert.equal(result.reducedMotion, 'on');
  assert.equal(result.uiScale, 1.2);
  assert.equal(result.muted, true);
  assert.ok(result.exportCount >= 10, `shared platform export surface is unexpectedly small: ${result.exportCount}`);

  await page.waitForFunction(() => Boolean(globalThis.__SPROUT_SHARED_PLATFORM__?.snapshot), null, { timeout: 15_000 });
  const consumer = await page.evaluate(() => ({
    adapter: globalThis.__SPROUT_SHARED_PLATFORM__.snapshot(),
    settingsPanel: Boolean(document.querySelector('#seed-game-settings')),
  }));
  assert.equal(consumer.adapter.version, 'seed-man-shared-platform-v1');
  assert.equal(consumer.settingsPanel, true, 'Seed Man shared settings UI did not initialize');
  assert.equal(typeof consumer.adapter.audioUnlocked, 'boolean');

  assert.equal(errors.length, 0, `browser errors while loading shared platform: ${errors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    route: '/games/shared-platform/',
    module: '/games/shared-platform/index.mjs',
    version: result.version,
    mime: contentType,
    exports: result.exportCount,
    consumer: consumer.adapter.version,
  }, null, 2));
} finally {
  await browser.close();
}
