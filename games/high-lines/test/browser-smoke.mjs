import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 41792;
const BASE = `http://127.0.0.1:${PORT}`;
const SCENE_CODE = 'HL4NES';
let server;
let browser;

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/games/high-lines/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('High Lines local server did not become ready.');
}

async function runViewport(name, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  const failed = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));

  try {
    const response = await page.goto(`${BASE}/games/high-lines/?lines=${SCENE_CODE}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.ok(response, `${name}: navigation produced no response`);
    assert.equal(response.status(), 200, `${name}: route returned ${response.status()}`);
    await page.waitForFunction(() => document.querySelector('#load-status')?.textContent?.includes('Ready') || document.querySelector('#load-status')?.textContent?.includes('Saved progress restored'), null, { timeout: 10_000 });
    await page.locator('#art-mount svg').waitFor({ state: 'visible', timeout: 10_000 });

    assert.equal(await page.locator('#scene-code').inputValue(), SCENE_CODE, `${name}: deterministic scene code did not load`);
    assert.equal(await page.locator('#palette button').count(), 8, `${name}: palette did not expose eight choices`);
    assert.ok(await page.locator('#art-mount [data-region]').count() > 0, `${name}: no colorable regions were rendered`);
    assert.equal(await page.locator('#art-mount [data-hidden]').count(), 3, `${name}: hidden-object contract changed`);

    const progressBefore = await page.locator('#progress-text').textContent();
    const firstRegion = page.locator('#art-mount [data-region]').first();
    await firstRegion.focus();
    assert.equal(await firstRegion.evaluate((node) => document.activeElement === node), true, `${name}: SVG region is not keyboard focusable`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    assert.notEqual(await page.locator('#progress-text').textContent(), progressBefore, `${name}: keyboard fill did not update progress`);
    assert.equal(await page.locator('#undo-fill').isEnabled(), true, `${name}: undo did not activate after a fill`);

    await page.locator('#zoom-in').click();
    assert.equal(await page.locator('#zoom-level').textContent(), '125%', `${name}: zoom-in did not update board zoom`);
    await page.locator('#zoom-reset').click();
    assert.equal(await page.locator('#zoom-level').textContent(), '100%', `${name}: fit did not reset board zoom`);

    const skip = page.locator('.skip-link');
    await skip.focus();
    assert.equal(await skip.evaluate((node) => document.activeElement === node), true, `${name}: skip link is not keyboard reachable`);

    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      mainCount: document.querySelectorAll('main.game-shell').length,
      liveRegions: document.querySelectorAll('[aria-live]').length,
      labelledButtons: [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() || button.getAttribute('aria-label')).length,
      buttonCount: document.querySelectorAll('button').length,
      keyboardSvgTargets: document.querySelectorAll('#art-mount [role="button"][tabindex="0"]').length
    }));
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, `${name}: horizontal document overflow ${metrics.scrollWidth}px > ${metrics.viewport}px`);
    assert.equal(metrics.mainCount, 1, `${name}: main game landmark missing`);
    assert.ok(metrics.liveRegions >= 2, `${name}: expected polite/assertive live feedback`);
    assert.equal(metrics.labelledButtons, metrics.buttonCount, `${name}: one or more buttons lack an accessible name`);
    assert.ok(metrics.keyboardSvgTargets > 0, `${name}: SVG board has no keyboard-operable targets`);

    assert.equal(errors.length, 0, `${name}: browser errors: ${errors.join(' | ')}`);
    assert.equal(failed.length, 0, `${name}: failed requests: ${failed.join(' | ')}`);
  } finally {
    await page.close();
  }
}

try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runViewport('desktop', { width: 1280, height: 900 });
  await runViewport('mobile', { width: 390, height: 844 });
  console.log('High Lines desktop/mobile browser, keyboard, responsive and accessibility smoke passed.');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
