import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4183;
const GAME_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server;
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Seed Man flag-completion test server did not start.');
}

try {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.locator('#game').waitFor({ state: 'visible' });
  await page.waitForFunction(() => typeof player !== 'undefined' && typeof level !== 'undefined' && typeof stepPlayer === 'function');

  await page.evaluate(() => {
    player.collected = [];
    player.finished = false;
    player.finishBlocked = false;
    player.x = level.finish.x - player.width + 1;
    player.y = level.finish.y + level.finish.height - player.height;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    running = true;
  });

  await page.waitForFunction(() => player.finished === true && player.finishBlocked === false, null, { timeout: 5000 });
  await page.locator('#finish-panel').waitFor({ state: 'visible' });
  const state = await page.evaluate(() => ({
    finished: player.finished,
    finishBlocked: player.finishBlocked,
    collected: player.collected.length,
    missingPickups: player.missingPickups,
    state: player.state,
    objective: document.querySelector('#load-status')?.textContent || ''
  }));

  assert.equal(state.finished, true, 'reaching the flag must finish the level');
  assert.equal(state.finishBlocked, false, 'optional sprouts must not lock the flag');
  assert.equal(state.collected, 0, 'browser test must prove a zero-sprout clear');
  assert.ok(state.missingPickups > 0, 'uncollected sprouts should remain tracked for mastery');
  assert.equal(state.state, 'finish');
  assert.match(state.objective, /Run complete/);
  assert.match(state.objective, /0 of 24 optional sprouts/);
  assert.equal(errors.length, 0, `Seed Man flag completion browser errors: ${errors.join(' | ')}`);

  console.log(JSON.stringify({
    ok: true,
    rule: 'flag-clears-with-optional-sprouts',
    collected: state.collected,
    missingPickups: state.missingPickups,
    objective: state.objective
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
