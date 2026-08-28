import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4179;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_URL = `${ORIGIN}/games/high-iq/`;

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
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('High IQ static test server did not start.');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /High IQ/i);
  await page.locator('#quiz-setup').waitFor({ state: 'visible' });
  assert.match(await page.locator('#loading-status').innerText(), /Verified bank ready/);
  assert.equal(await page.locator('#hero-question-count').innerText(), '80');
  assert.equal(await page.locator('#hero-source-count').innerText(), '50');
  assert.equal(await page.locator('#topic-map article').count(), 10);

  await page.locator('#question-count').selectOption('5');
  await page.locator('#start-quiz').click();
  await page.locator('#quiz-panel').waitFor({ state: 'visible' });

  for (let index = 0; index < 5; index += 1) {
    assert.equal(await page.locator('#answer-options .answer-option').count(), 4);
    await page.locator('#answer-options .answer-option').first().click();
    await page.locator('#lock-answer').click();
    await page.locator('#answer-feedback').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#answer-explanation').innerText()).trim().length > 20);
    assert.ok((await page.locator('#answer-context').innerText()).trim().length > 10);
    assert.ok(await page.locator('#answer-sources li').count() >= 1);
    await page.locator('#next-question').click();
  }

  await page.locator('#results-panel').waitFor({ state: 'visible' });
  assert.match(await page.locator('#result-score').innerText(), /%/);
  assert.match(await page.locator('#result-accuracy').innerText(), /%/);
  assert.ok((await page.locator('#result-rank').innerText()).trim().length > 0);
  assert.ok(await page.locator('#history-list .history-item').count() >= 1);
  assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join(' | ')}`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileErrors = [];
  mobile.on('console', (message) => {
    if (message.type() === 'error') mobileErrors.push(message.text());
  });
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  await mobile.goto(GAME_URL, { waitUntil: 'networkidle' });
  await mobile.locator('#quiz-setup').waitFor({ state: 'visible' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Mobile layout overflows horizontally by ${overflow}px`);
  assert.equal(mobileErrors.length, 0, `Mobile console errors: ${mobileErrors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    desktop: '1280x900',
    mobile: '390x844',
    completedQuestions: 5,
    consoleErrors: 0,
    mobileOverflowPx: overflow
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
