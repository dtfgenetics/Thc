import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { validateReplayBundle } from '../../shared-platform/src/replay.mjs';

const PORT = 4183;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const GAME_URL = `${ORIGIN}/games/high-iq/?debug=1`;

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
  throw lastError || new Error('High IQ debug replay server did not start.');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.locator('#quiz-setup').waitFor({ state: 'visible' });
  await page.waitForFunction(() => globalThis.__DTF_HIGH_IQ_DEBUG__?.enabled === true);

  await page.locator('#question-count').selectOption('5');
  await page.locator('#start-quiz').click();
  await page.locator('#quiz-panel').waitFor({ state: 'visible' });

  const presentedIds = [];
  for (let index = 0; index < 5; index += 1) {
    const questionId = (await page.locator('#question-id').innerText()).trim();
    presentedIds.push(questionId);
    const answer = page.locator('#answer-options .answer-option').first();
    await answer.click();
    await page.locator('#lock-answer').click();
    await page.locator('#answer-feedback').waitFor({ state: 'visible' });
    await page.locator('#next-question').click();
  }

  await page.locator('#results-panel').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const bundle = globalThis.__DTF_HIGH_IQ_DEBUG__?.exportReplay?.();
    return bundle?.actions?.some((action) => action.type === 'session_complete');
  });

  const bundle = await page.evaluate(() => globalThis.__DTF_HIGH_IQ_DEBUG__.exportReplay());
  const text = await page.evaluate(() => globalThis.__DTF_HIGH_IQ_DEBUG__.exportReplayText());
  const validation = validateReplayBundle(bundle, { expectedGameId: 'high-iq' });
  assert.equal(validation.valid, true, validation.errors.join('; '));
  assert.equal(typeof text, 'string');
  assert.equal(JSON.parse(text).gameId, 'high-iq');
  assert.match(bundle.releaseVersion, /^high-iq-v3\.3\/data-/);
  assert.equal(bundle.seedOrCode, null, 'non-daily runs should not claim a deterministic daily seed');

  const actionsByType = (type) => bundle.actions.filter((action) => action.type === type);
  assert.equal(actionsByType('session_start').length, 1);
  assert.equal(actionsByType('question_presented').length, 5);
  assert.equal(actionsByType('answer_select').length, 5);
  assert.equal(actionsByType('answer_lock').length, 5);
  assert.equal(actionsByType('advance').length, 5);
  assert.equal(actionsByType('session_complete').length, 1);
  assert.deepEqual(actionsByType('question_presented').map((action) => action.payload.questionId), presentedIds);
  assert.deepEqual(actionsByType('answer_lock').map((action) => action.payload.questionId), presentedIds);
  assert.deepEqual(actionsByType('advance').map((action) => action.payload.fromQuestionId), presentedIds);
  assert.equal(bundle.result.rank.length > 0, true);
  assert.match(bundle.result.scoreText, /%/);
  assert.equal(errors.length, 0, `Browser errors: ${errors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    gameId: bundle.gameId,
    releaseVersion: bundle.releaseVersion,
    questions: presentedIds.length,
    actions: bundle.actions.length,
    replayValidated: true,
    browserErrors: 0,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
