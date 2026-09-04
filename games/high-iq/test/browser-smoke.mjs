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

async function assertGameplayGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const options = [...document.querySelectorAll('#answer-options .answer-option')];
    const lock = document.querySelector('#lock-answer');
    const scoreboard = document.querySelector('.quiz-scoreboard');
    const controls = document.querySelector('.quiz-controls');
    return {
      optionHeights: options.map((node) => node.getBoundingClientRect().height),
      lockHeight: lock?.getBoundingClientRect().height || 0,
      scoreboardPosition: scoreboard ? getComputedStyle(scoreboard).position : '',
      controlsPosition: controls ? getComputedStyle(controls).position : '',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  assert.equal(geometry.optionHeights.length, 4, `${label}: expected four answer targets`);
  assert.ok(geometry.optionHeights.every((height) => height >= 44), `${label}: answer target below 44px: ${geometry.optionHeights.join(', ')}`);
  assert.ok(geometry.lockHeight >= 44, `${label}: lock-answer target below 44px: ${geometry.lockHeight}`);
  assert.equal(geometry.scoreboardPosition, 'sticky', `${label}: scoreboard must remain sticky during play`);
  assert.equal(geometry.controlsPosition, 'sticky', `${label}: gameplay controls must remain sticky during play`);
  assert.ok(geometry.overflow <= 1, `${label}: layout overflows horizontally by ${geometry.overflow}px`);
  return geometry;
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

  const visualLayerLoaded = await page.evaluate(() => [...document.styleSheets].some((sheet) => String(sheet.href || '').includes('high-iq-v3-3.css')));
  assert.equal(visualLayerLoaded, true, 'High IQ v3.3 gameplay-first stylesheet must load in Chromium');

  const manifest = await page.evaluate(async () => {
    const response = await fetch('./data/manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest returned ${response.status}`);
    return response.json();
  });
  assert(Number.isInteger(manifest.questionCount) && manifest.questionCount > 0);
  assert(Number.isInteger(manifest.sourceCount) && manifest.sourceCount > 0);
  assert.equal(await page.locator('#hero-question-count').innerText(), String(manifest.questionCount));
  assert.equal(await page.locator('#hero-source-count').innerText(), String(manifest.sourceCount));
  assert.equal(await page.locator('#hero-version').innerText(), String(manifest.datasetVersion));
  assert.equal(await page.locator('#topic-map article').count(), Object.keys(manifest.categoryCounts || {}).length);

  await page.locator('#question-count').selectOption('5');
  await page.locator('#start-quiz').click();
  await page.locator('#quiz-panel').waitFor({ state: 'visible' });
  const desktopGeometry = await assertGameplayGeometry(page, 'desktop');

  for (let index = 0; index < 5; index += 1) {
    assert.equal(await page.locator('#answer-options .answer-option').count(), 4);
    await page.locator('#answer-options .answer-option').first().click();
    assert.equal(await page.locator('#answer-options .answer-option').first().getAttribute('aria-pressed'), 'true');
    await page.locator('#lock-answer').click();
    await page.locator('#answer-feedback').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#answer-explanation').innerText()).trim().length > 20);
    assert.ok((await page.locator('#answer-context').innerText()).trim().length > 10);
    assert.ok(await page.locator('#answer-sources li').count() >= 1);
    assert.equal(await page.locator('#answer-options .answer-option.is-correct').count(), 1, 'exactly one answer should reveal as correct');

    if (index === 0) {
      const progressBefore = await page.locator('#progress-text').innerText();
      const sourceDrawer = page.locator('#answer-feedback .source-drawer');
      await sourceDrawer.locator('summary').click();
      assert.equal(await sourceDrawer.getAttribute('open'), '');
      const sourceLink = page.locator('#answer-sources a').first();
      await sourceLink.focus();
      assert.equal(await sourceLink.evaluate((element) => document.activeElement === element), true);
      const keyboardResult = await sourceLink.evaluate((element) => {
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        const allowed = element.dispatchEvent(event);
        return { allowed, defaultPrevented: event.defaultPrevented };
      });
      assert.equal(keyboardResult.allowed, true, 'source-link Enter should retain its native default action');
      assert.equal(keyboardResult.defaultPrevented, false, 'source-link Enter must not be prevented by quiz shortcuts');
      assert.equal(await page.locator('#progress-text').innerText(), progressBefore, 'source-link Enter must not advance the quiz');
    }

    await page.locator('#next-question').click();
  }

  await page.locator('#results-panel').waitFor({ state: 'visible' });
  assert.match(await page.locator('#result-score').innerText(), /%/);
  assert.match(await page.locator('#result-accuracy').innerText(), /%/);
  assert.ok((await page.locator('#result-rank').innerText()).trim().length > 0);
  assert.ok(await page.locator('#history-list .history-item').count() >= 1);
  assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join(' | ')}`);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce'
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on('console', (message) => {
    if (message.type() === 'error') mobileErrors.push(message.text());
  });
  mobile.on('pageerror', (error) => mobileErrors.push(error.message));
  await mobile.goto(GAME_URL, { waitUntil: 'networkidle' });
  await mobile.locator('#quiz-setup').waitFor({ state: 'visible' });
  assert.equal(await mobile.locator('#hero-question-count').innerText(), String(manifest.questionCount));
  assert.equal(await mobile.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true, 'mobile QA context must exercise reduced-motion CSS');
  await mobile.locator('#question-count').selectOption('5');
  await mobile.locator('#start-quiz').click();
  await mobile.locator('#quiz-panel').waitFor({ state: 'visible' });
  const mobileGeometry = await assertGameplayGeometry(mobile, 'mobile');
  assert.equal(await mobile.locator('#answer-options .answer-option').count(), 4);
  await mobile.locator('#answer-options .answer-option').nth(1).click();
  assert.equal(await mobile.locator('#answer-options .answer-option').nth(1).getAttribute('aria-pressed'), 'true');
  await mobile.locator('#lock-answer').click();
  await mobile.locator('#answer-feedback').waitFor({ state: 'visible' });
  assert.equal(await mobile.locator('#answer-options .answer-option.is-correct').count(), 1);
  assert.equal(mobileErrors.length, 0, `Mobile console errors: ${mobileErrors.join(' | ')}`);
  await mobileContext.close();

  console.log(JSON.stringify({
    ok: true,
    desktop: '1280x900',
    mobile: '390x844',
    datasetVersion: manifest.datasetVersion,
    bankQuestions: manifest.questionCount,
    completedQuestions: 5,
    visualLayer: 'high-iq-v3-3.css',
    sourceLinkKeyboardGuard: true,
    reducedMotionChecked: true,
    minDesktopAnswerHeight: Math.min(...desktopGeometry.optionHeights),
    minMobileAnswerHeight: Math.min(...mobileGeometry.optionHeights),
    consoleErrors: 0,
    mobileOverflowPx: mobileGeometry.overflow
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
