import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 41791;
const BASE = `http://127.0.0.1:${PORT}`;
const CASE_CODE = 'RWT42P';
let server;
let browser;

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/games/root-cause/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Root Cause local server did not become ready.');
}

async function runViewport(name, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  const failed = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));

  try {
    const response = await page.goto(`${BASE}/games/root-cause/?case=${CASE_CODE}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.ok(response, `${name}: navigation produced no response`);
    assert.equal(response.status(), 200, `${name}: route returned ${response.status()}`);
    await page.waitForFunction(() => document.querySelector('#load-status')?.textContent === 'Lab online', null, { timeout: 10_000 });

    assert.equal(await page.locator('#case-code').inputValue(), CASE_CODE, `${name}: deterministic case code did not load`);
    assert.equal(await page.locator('#inspections button:not([disabled])').count() > 0, true, `${name}: no usable inspection actions`);
    assert.equal(await page.locator('#diagnoses button:not([disabled])').count() > 0, true, `${name}: no usable diagnosis actions`);

    const initialEvidence = await page.locator('#evidence .evidence-item').count();
    await page.locator('#inspections button:not([disabled])').first().click();
    assert.equal(await page.locator('#evidence .evidence-item').count(), initialEvidence + 1, `${name}: inspection did not add evidence`);
    assert.match(await page.locator('#inspection-stat').textContent(), /^1 \/ 2$/, `${name}: inspection HUD did not update`);

    const firstDiagnosis = page.locator('#diagnoses button:not([disabled])').first();
    await firstDiagnosis.focus();
    assert.equal(await firstDiagnosis.evaluate((node) => document.activeElement === node), true, `${name}: diagnosis button is not keyboard focusable`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    assert.notEqual(await page.locator('#guess-status').textContent(), '2 guesses available', `${name}: keyboard diagnosis activation did not update state`);

    const skip = page.locator('.skip-link');
    await skip.focus();
    assert.equal(await skip.evaluate((node) => document.activeElement === node), true, `${name}: skip link is not keyboard reachable`);

    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasMainLabel: Boolean(document.querySelector('main#game')),
      liveRegions: document.querySelectorAll('[aria-live]').length,
      labelledButtons: [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() || button.getAttribute('aria-label')).length,
      buttonCount: document.querySelectorAll('button').length
    }));
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, `${name}: horizontal document overflow ${metrics.scrollWidth}px > ${metrics.viewport}px`);
    assert.equal(metrics.hasMainLabel, true, `${name}: main game landmark missing`);
    assert.ok(metrics.liveRegions >= 2, `${name}: expected feedback and assertive live regions`);
    assert.equal(metrics.labelledButtons, metrics.buttonCount, `${name}: one or more buttons lack an accessible name`);

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
  console.log('Root Cause desktop/mobile browser, keyboard, responsive and accessibility smoke passed.');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
