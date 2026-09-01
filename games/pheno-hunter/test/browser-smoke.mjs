import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4186;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_URL = `${ORIGIN}/games/pheno-hunter/?hunt=ABC234`;

let server;
let browser;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  throw lastError || new Error('Pheno Hunter static test server did not start.');
}

function collectErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function waitForReady(page) {
  await page.locator('#load-status').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#load-status')?.textContent?.trim() === 'Greenhouse online');
  await page.waitForFunction(() => document.querySelectorAll('.candidate-card').length === 8);
}

async function loadCode(page, code) {
  const input = page.locator('#hunt-code');
  await input.fill(code);
  await input.press('Enter');
  await page.waitForFunction((expected) => document.querySelector('#code-stat')?.textContent?.trim() === expected, code);
}

async function cohortSnapshot(page) {
  return {
    code: (await page.locator('#code-stat').innerText()).trim(),
    brief: (await page.locator('#brief-title').innerText()).trim(),
    candidates: await page.locator('.candidate-id h3').allInnerTexts()
  };
}

async function assertAccessibilityContracts(page) {
  const labelTarget = await page.locator('label[for="hunt-code"]').count();
  assert.equal(labelTarget, 1, 'Hunt-code input must have an explicit label.');
  assert.equal(await page.locator('#load-status').getAttribute('role'), 'status');
  assert.equal(await page.locator('#announce').getAttribute('aria-live'), 'assertive');
  assert.equal(await page.locator('.skip-link').getAttribute('href'), '#game');

  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')), true, 'First keyboard stop should be the skip link.');

  const unnamedButtons = await page.locator('button').evaluateAll((buttons) => buttons
    .filter((button) => !(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.trim()))
    .length);
  assert.equal(unnamedButtons, 0, 'Every button must have an accessible text/name source.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true, 'Reduced-motion preference must be observable by the runtime.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function runDesktop(page) {
  const errors = collectErrors(page);
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForReady(page);

  assert.match(await page.title(), /Pheno Hunter/i);
  assert.equal((await page.locator('#token-stat').innerText()).trim(), '10');
  assert.equal((await page.locator('#shortlist-stat').innerText()).trim(), '0 / 3');
  assert.equal((await page.locator('#observed-stat').innerText()).trim(), '0 traits');
  await assertAccessibilityContracts(page);

  const original = await cohortSnapshot(page);
  assert.equal(original.code, 'ABC234');
  assert.equal(original.candidates.length, 8);

  await loadCode(page, 'DEF567');
  const alternate = await cohortSnapshot(page);
  assert.equal(alternate.code, 'DEF567');
  assert.notDeepEqual(alternate, original, 'A different valid hunt code should produce a different hunt state.');

  await loadCode(page, 'ABC234');
  const replay = await cohortSnapshot(page);
  assert.deepEqual(replay, original, 'The same hunt code must replay the same brief and ordered cohort.');

  const input = page.locator('#hunt-code');
  await input.fill('A');
  await input.press('Enter');
  assert.equal(await input.getAttribute('aria-invalid'), 'true', 'Incomplete hunt codes must be marked invalid.');
  await loadCode(page, 'ABC234');
  assert.equal(await input.getAttribute('aria-invalid'), 'false');

  const firstCard = page.locator('.candidate-card').first();
  const firstName = (await firstCard.locator('h3').innerText()).trim();
  const firstScout = firstCard.locator('.scout-button').first();
  await firstScout.click();
  assert.equal((await page.locator('#token-stat').innerText()).trim(), '9');
  assert.equal((await page.locator('#observed-stat').innerText()).trim(), '1 trait');
  assert.match((await page.locator('#announce').innerText()).trim(), new RegExp(firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  for (let index = 0; index < 3; index += 1) {
    await page.locator('.candidate-card').nth(index).locator('.shortlist-button').click();
  }
  assert.equal((await page.locator('#shortlist-stat').innerText()).trim(), '3 / 3');
  assert.equal(await page.locator('#shortlist .shortlist-row').count(), 3);

  const fourthShortlist = page.locator('.candidate-card').nth(3).locator('.shortlist-button');
  assert.equal(await fourthShortlist.isDisabled(), true, 'A fourth candidate must not enter the three-slot shortlist.');
  assert.match((await fourthShortlist.innerText()).trim(), /Shortlist full/i);

  await page.locator('#shortlist [data-lock]').first().click();
  await page.locator('#result-panel').waitFor({ state: 'visible' });
  assert.match((await page.locator('#result-score').innerText()).trim(), /100 scouting score/i);
  assert.equal(await page.locator('#result-breakdown > div').count(), 3);
  assert.equal(await page.locator('#result-ranking > div').count(), 3);
  assert.match((await page.locator('#announce').innerText()).trim(), /selected\. Final scouting score/i);

  await page.locator('#next-hunt').click();
  assert.equal(await page.locator('#result-panel').isHidden(), true);
  assert.equal((await page.locator('#token-stat').innerText()).trim(), '10');
  assert.equal((await page.locator('#shortlist-stat').innerText()).trim(), '0 / 3');
  assert.equal((await page.locator('#observed-stat').innerText()).trim(), '0 traits');

  assert.equal(errors.length, 0, `Desktop browser errors: ${errors.join(' | ')}`);
}

async function runMobile(page) {
  const errors = collectErrors(page);
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await waitForReady(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Mobile layout overflows horizontally by ${overflow}px.`);

  const firstScout = page.locator('.scout-button').first();
  const shortlist = page.locator('.shortlist-button').first();
  await firstScout.scrollIntoViewIfNeeded();
  const scoutBox = await firstScout.boundingBox();
  const shortlistBox = await shortlist.boundingBox();
  assert.ok((scoutBox?.height || 0) >= 44, `Scout touch target must be at least 44px tall, got ${scoutBox?.height || 0}.`);
  assert.ok((shortlistBox?.height || 0) >= 44, `Shortlist touch target must be at least 44px tall, got ${shortlistBox?.height || 0}.`);

  await firstScout.tap();
  assert.equal((await page.locator('#token-stat').innerText()).trim(), '9');
  await shortlist.tap();
  assert.equal((await page.locator('#shortlist-stat').innerText()).trim(), '1 / 3');

  const codeInput = page.locator('#hunt-code');
  await codeInput.fill('DEF567');
  await codeInput.press('Enter');
  assert.equal((await page.locator('#code-stat').innerText()).trim(), 'DEF567');

  assert.equal(errors.length, 0, `Mobile browser errors: ${errors.join(' | ')}`);
}

try {
  server = spawn('python3', [
    '-m', 'http.server', String(PORT),
    '--bind', '127.0.0.1',
    '--directory', 'site/public-route-patch'
  ], { stdio: 'ignore' });

  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await runDesktop(desktop);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await runMobile(mobile);
  await mobile.close();

  console.log('Pheno Hunter browser acceptance passed: desktop gameplay, deterministic replay, keyboard/accessibility contracts, and 390px touch layout.');
} finally {
  await browser?.close();
  if (server) server.kill('SIGTERM');
}
