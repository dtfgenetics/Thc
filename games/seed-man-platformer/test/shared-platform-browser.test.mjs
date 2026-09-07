import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4188;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_URL = `${ORIGIN}/games/seed-man-platformer/`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = spawn('python3', [
  '-m', 'http.server', String(PORT),
  '--bind', '127.0.0.1',
  '--directory', 'site/public-route-patch'
], { stdio: 'ignore' });

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error('Seed Man shared-platform test server did not start.');
}

async function waitForSharedPlatform(page) {
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => globalThis.__SPROUT_SHARED_PLATFORM__?.version === 'seed-man-shared-platform-v1');
  await page.waitForFunction(() => {
    try { return Boolean(player && level && player.grounded); } catch { return false; }
  });
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForSharedPlatform(page);

  const initial = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.snapshot());
  assert.equal(initial.settings.muted, false);
  assert.equal(initial.settings.reducedMotion, 'system');
  assert.equal(initial.settings.highContrast, 'system');
  assert.equal(initial.settings.uiScale, 1);

  const summary = page.locator('#seed-game-settings summary');
  assert.ok((await summary.boundingBox())?.height >= 44, 'Settings summary must keep a 44px minimum target.');
  await summary.click();
  await page.locator('#seed-motion-setting').selectOption('on');
  await page.locator('#seed-contrast-setting').selectOption('on');
  await page.locator('#seed-ui-scale').fill('1.2');
  await page.locator('#seed-sound-toggle').click();

  let snapshot = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.snapshot());
  assert.equal(snapshot.settings.reducedMotion, 'on');
  assert.equal(snapshot.settings.highContrast, 'on');
  assert.equal(snapshot.settings.uiScale, 1.2);
  assert.equal(snapshot.settings.muted, true);
  assert.equal(await page.locator('html').getAttribute('data-dtf-reduced-motion'), 'true');
  assert.equal(await page.locator('html').getAttribute('data-dtf-high-contrast'), 'true');
  assert.equal(await page.locator('html').getAttribute('data-dtf-muted'), 'true');
  assert.equal(await page.locator('html').evaluate((node) => node.style.getPropertyValue('--dtf-ui-scale')), '1.2');

  await page.reload({ waitUntil: 'networkidle' });
  await waitForSharedPlatform(page);
  snapshot = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.snapshot());
  assert.equal(snapshot.settings.reducedMotion, 'on', 'Reduced-motion preference should survive reload.');
  assert.equal(snapshot.settings.highContrast, 'on', 'High-contrast preference should survive reload.');
  assert.equal(snapshot.settings.uiScale, 1.2, 'UI scale should survive reload.');
  assert.equal(snapshot.settings.muted, true, 'Mute preference should survive reload.');

  await page.locator('#seed-game-settings summary').click();
  await page.locator('#seed-sound-toggle').click();
  await page.waitForFunction(() => globalThis.__SPROUT_SHARED_PLATFORM__?.snapshot().audioUnlocked === true);
  assert.match(await page.locator('#seed-audio-status').innerText(), /Sound ready/i);

  const tonesBefore = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.snapshot().toneEvents);
  const played = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.playCue('sprout'));
  assert.equal(played, true, 'Shared audio manager should play a cue after user unlock.');
  const tonesAfter = await page.evaluate(() => globalThis.__SPROUT_SHARED_PLATFORM__.snapshot().toneEvents);
  assert.equal(tonesAfter, tonesBefore + 1);

  await page.locator('#game').focus();
  const xBefore = await page.evaluate(() => player.x);
  await page.keyboard.down('ArrowRight');
  await sleep(220);
  await page.keyboard.up('ArrowRight');
  const xAfter = await page.evaluate(() => player.x);
  assert.ok(xAfter > xBefore + 15, `Shared settings layer must not block movement: ${xBefore} -> ${xAfter}`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileErrors = [];
  mobile.on('console', (message) => { if (message.type() === 'error') mobileErrors.push(message.text()); });
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  await mobile.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForSharedPlatform(mobile);
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Shared settings UI causes ${overflow}px horizontal overflow on mobile.`);
  assert.ok((await mobile.locator('#seed-game-settings summary').boundingBox())?.height >= 44);
  assert.ok((await mobile.locator('[data-control="jump"]').boundingBox())?.height >= 72, 'Existing mobile jump target regressed.');

  assert.equal(errors.length, 0, `Desktop browser errors: ${errors.join(' | ')}`);
  assert.equal(mobileErrors.length, 0, `Mobile browser errors: ${mobileErrors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    adapter: 'seed-man-shared-platform-v1',
    persistence: true,
    accessibility: true,
    audioUnlocked: true,
    cuePlayback: true,
    movementPreserved: true,
    mobileOverflow: overflow,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
