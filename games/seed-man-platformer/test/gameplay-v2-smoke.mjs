import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4182;
const LOCAL_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
const configured = process.env.SPROUT_GAME_URL?.trim();
const isLive = Boolean(configured);
const GAME_URL = configured || LOCAL_URL;
let server;
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  if (isLive) return;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(LOCAL_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Sprout Run gameplay-v2 static server did not start.');
}

try {
  if (!isLive) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'site/public-route-patch'], { stdio: 'ignore' });
  }
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  const url = isLive ? `${GAME_URL}${GAME_URL.includes('?') ? '&' : '?'}gameplay_v2=${Date.now()}` : GAME_URL;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#load-status')?.dataset.state === 'progress' && /24/.test(document.querySelector('#load-status')?.textContent || ''));
  await page.waitForFunction(() => Boolean(window.__SPROUT_GAMEPLAY_V2__?.snapshot));

  const contract = await page.evaluate(() => ({
    version: window.__SPROUT_GAMEPLAY_V2__.version,
    mechanics: [...window.__SPROUT_GAMEPLAY_V2__.mechanics],
    snapshot: window.__SPROUT_GAMEPLAY_V2__.snapshot()
  }));
  assert.equal(contract.version, 'sprout-run-gameplay-v2');
  for (const mechanic of ['moving-platforms','stompable-pests','bounce-pads','particles','screen-shake','squash-stretch']) {
    assert.ok(contract.mechanics.includes(mechanic), `Missing gameplay mechanic ${mechanic}`);
  }
  assert.ok(contract.snapshot.movingPlatforms.length >= 6, 'Expected at least six moving greenhouse platforms.');
  assert.ok(contract.snapshot.pests.length >= 8, 'Expected at least eight stompable pests.');
  assert.ok(contract.snapshot.bouncePads.length >= 4, 'Expected at least four boost pads.');

  const movingBefore = contract.snapshot.movingPlatforms[0].x;
  await page.waitForTimeout(420);
  const movingAfter = await page.evaluate(() => window.__SPROUT_GAMEPLAY_V2__.snapshot().movingPlatforms[0].x);
  assert.ok(Math.abs(movingAfter - movingBefore) > 1, `Moving platform did not move enough: ${movingBefore} -> ${movingAfter}`);

  await page.evaluate(() => {
    const pest = window.__SPROUT_GAMEPLAY_V2__.snapshot().pests.find((item) => !item.dead);
    player.x = pest.x + pest.width / 2 - player.width / 2;
    player.y = pest.y - player.height - 12;
    player.vx = 0;
    player.vy = 260;
    player.grounded = false;
    player.power.invulnerableTimer = 0;
  });
  await page.waitForFunction(() => window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.stomps >= 1);
  const stompState = await page.evaluate(() => ({
    vy: player.vy,
    stomps: window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.stomps,
    deadPests: window.__SPROUT_GAMEPLAY_V2__.snapshot().pests.filter((pest) => pest.dead).length
  }));
  assert.ok(stompState.stomps >= 1 && stompState.deadPests >= 1, 'Pest stomp did not register.');
  assert.ok(stompState.vy < 0, `Stomp should bounce Seed Man upward, got vy=${stompState.vy}`);

  await page.evaluate(() => reset());
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    const pad = window.__SPROUT_GAMEPLAY_V2__.snapshot().bouncePads[0];
    player.x = pad.x + pad.width / 2 - player.width / 2;
    player.y = pad.y - player.height - 16;
    player.vx = 0;
    player.vy = 300;
    player.grounded = false;
  });
  await page.waitForFunction(() => window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.padBounces >= 1);
  const padState = await page.evaluate(() => ({
    vy: player.vy,
    padBounces: window.__SPROUT_GAMEPLAY_V2__.snapshot().stats.padBounces,
    particles: window.__SPROUT_GAMEPLAY_V2__.snapshot().particles
  }));
  assert.ok(padState.padBounces >= 1, 'Boost pad did not trigger.');
  assert.ok(padState.vy < -300, `Boost pad should launch Seed Man upward, got vy=${padState.vy}`);
  assert.ok(padState.particles > 0, 'Boost pad should emit visual feedback particles.');

  assert.equal(errors.length, 0, `Gameplay-v2 browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, mode: isLive ? 'live-production' : 'local-public-route', version: contract.version, movingPlatforms: contract.snapshot.movingPlatforms.length, pests: contract.snapshot.pests.length, bouncePads: contract.snapshot.bouncePads.length, stomp: true, boostPad: true, particles: true }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}