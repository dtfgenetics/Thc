import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4191;
const GAME_URL = `http://127.0.0.1:${PORT}/games/seed-man-platformer/`;
const TARGETS = Object.freeze({
  'reservoir-tempest-gnat': { x: 3820, y: 300, yOffsets: [-42, -24, -8, 8, 24, 42] },
  'nursery-hydro-beetle': { x: 3360, y: 446, yOffsets: [0] }
});
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

async function combatSnapshot(page) {
  return page.evaluate(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null);
}

async function selectLevel(page, levelId) {
  await page.evaluate((id) => window.__SPROUT_CAMPAIGN_EXPERIENCE__?.selectLevel?.(id), levelId);
  await page.waitForFunction((id) => {
    try {
      return level?.id === id && window.__SPROUT_COMBAT_BROWSER__?.snapshot?.().levelId === id;
    } catch {
      return false;
    }
  }, levelId, { timeout: 5000 });
}

async function defeatEnemy(page, enemyId) {
  const target = TARGETS[enemyId];
  assert.ok(target, `Missing authored target coordinates for ${enemyId}`);
  const offsets = target.yOffsets || [0];

  for (let shot = 0; shot < 80; shot += 1) {
    const snapshot = await combatSnapshot(page);
    const enemy = snapshot.enemies.find((entry) => entry.id === enemyId);
    assert.ok(enemy, `Missing ${enemyId}`);
    if (enemy.defeated) return;

    const yOffset = offsets[shot % offsets.length];
    await page.evaluate(({ x, y, yOffset }) => {
      player.x = Math.max(0, x - 55);
      player.y = y + yOffset - player.height * 0.46;
      player.vx = 18;
      player.vy = 0;
      player.grounded = false;
    }, { ...target, yOffset });

    await page.keyboard.press('j');
    await sleep(230);
  }
  const finalSnapshot = await combatSnapshot(page);
  const finalEnemy = finalSnapshot.enemies.find((entry) => entry.id === enemyId);
  throw new Error(`Could not defeat ${enemyId}; final state ${JSON.stringify(finalEnemy)}`);
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

  await selectLevel(page, 'reservoir-run');
  await defeatEnemy(page, 'reservoir-tempest-gnat');
  let snapshot = await combatSnapshot(page);
  assert.equal(snapshot.activePhenotype, 'terpene-tempest');

  await page.evaluate(() => {
    player.x = 2200;
    player.y = 220;
    player.vx = 0;
    player.vy = 260;
    player.grounded = false;
  });
  await page.keyboard.press('k');
  await page.keyboard.down('Space');
  await sleep(120);
  const flight = await page.evaluate(() => ({ y: player.y, vy: player.vy, state: player.state, grounded: player.grounded }));
  await page.keyboard.up('Space');
  assert.match(flight.state, /phenotype-flight|phenotype-glide/, 'Tempest special should own the returned movement state.');
  assert.equal(flight.grounded, false);
  assert.ok(flight.vy < 260, `Tempest flight should reduce/reverse fall velocity; got ${flight.vy}`);

  await selectLevel(page, 'nursery-night-shift');
  await defeatEnemy(page, 'nursery-hydro-beetle');
  snapshot = await combatSnapshot(page);
  assert.equal(snapshot.activePhenotype, 'hydro-surge');

  await page.evaluate(() => {
    player.x = 2200;
    player.y = 180;
    player.vx = 0;
    player.vy = 520;
    player.grounded = false;
  });
  await page.keyboard.press('k');
  await sleep(80);
  const bubble = await page.evaluate(() => ({ vy: player.vy, state: player.state, grounded: player.grounded }));
  assert.equal(bubble.state, 'phenotype-bubble');
  assert.equal(bubble.grounded, false);
  assert.ok(bubble.vy <= 120, `Hydro bubble should cap downward velocity at 120; got ${bubble.vy}`);

  assert.equal(errors.length, 0, `Phenotype mobility browser errors: ${errors.join(' | ')}`);
  console.log('Seed Man Tempest flight and Hydro bubble authoritative-frame browser regression passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
