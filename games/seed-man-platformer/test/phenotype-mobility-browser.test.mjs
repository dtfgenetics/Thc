import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4191;
const GAME_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
let server;
let browser;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(GAME_URL, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Seed Man phenotype mobility browser server did not start.');
}

try {
  server = spawn('python3', [
    '-m', 'http.server', String(PORT),
    '--bind', '127.0.0.1',
    '--directory', 'site/public-route-patch'
  ], { stdio: 'ignore' });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__SPROUT_COMBAT_BROWSER__?.installed === true);
  await page.waitForFunction(() => window.__SPROUT_CANVAS_COMPAT__?.mobilityFrameRepairInstalled === true);

  const compat = await page.evaluate(() => ({
    marker: window.__SPROUT_CANVAS_COMPAT__?.phenotypeMobilityFrameRepair,
    installed: window.__SPROUT_CANVAS_COMPAT__?.mobilityFrameRepairInstalled
  }));
  assert.equal(compat.marker, 'seed-man-phenotype-mobility-frame-v1');
  assert.equal(compat.installed, true);

  // Enemy defeat -> phenotype absorption is already covered by combat-browser.test.mjs.
  // This regression isolates the frame-ordering contract: the compatibility wrapper
  // must apply an active mobility form to the player object returned by physics.
  await page.evaluate(() => {
    const baseCombat = window.__SPROUT_COMBAT_BROWSER__;
    window.__SPROUT_MOBILITY_TEST_STATE__ = { phenotype: 'terpene-tempest', specialTimer: 4, bubbleHits: 0 };
    window.__SPROUT_COMBAT_BROWSER__ = Object.freeze({
      ...baseCombat,
      snapshot: () => ({
        ...baseCombat.snapshot(),
        activePhenotype: window.__SPROUT_MOBILITY_TEST_STATE__.phenotype,
        specialTimer: window.__SPROUT_MOBILITY_TEST_STATE__.specialTimer,
        bubbleHits: window.__SPROUT_MOBILITY_TEST_STATE__.bubbleHits
      })
    });
  });

  await page.evaluate(() => {
    player.x = 2200;
    player.y = 220;
    player.vx = 0;
    player.vy = 260;
    player.grounded = false;
  });
  await page.keyboard.down('Space');
  await sleep(120);
  const flight = await page.evaluate(() => ({ y: player.y, vy: player.vy, state: player.state, grounded: player.grounded }));
  await page.keyboard.up('Space');
  assert.match(flight.state, /phenotype-flight|phenotype-glide/, 'Tempest special should own the returned movement state.');
  assert.equal(flight.grounded, false);
  assert.ok(flight.vy < 260, `Tempest flight should reduce/reverse fall velocity; got ${flight.vy}`);

  await page.evaluate(() => {
    window.__SPROUT_MOBILITY_TEST_STATE__.phenotype = 'hydro-surge';
    window.__SPROUT_MOBILITY_TEST_STATE__.specialTimer = 5;
    window.__SPROUT_MOBILITY_TEST_STATE__.bubbleHits = 1;
    player.x = 2200;
    player.y = 180;
    player.vx = 0;
    player.vy = 520;
    player.grounded = false;
    player.power = player.power || {};
    player.power.invulnerableTimer = 0;
  });
  await sleep(80);
  const bubble = await page.evaluate(() => ({
    vy: player.vy,
    state: player.state,
    grounded: player.grounded,
    invulnerableTimer: player.power?.invulnerableTimer || 0
  }));
  assert.equal(bubble.state, 'phenotype-bubble');
  assert.equal(bubble.grounded, false);
  assert.ok(bubble.vy <= 120, `Hydro bubble should cap downward velocity at 120; got ${bubble.vy}`);
  assert.ok(bubble.invulnerableTimer > 0, 'Hydro bubble should preserve its brief impact protection on the returned frame.');

  assert.equal(errors.length, 0, `Phenotype mobility browser errors: ${errors.join(' | ')}`);
  console.log('Seed Man Tempest flight and Hydro bubble authoritative-frame browser regression passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
