import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4187;
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
  throw new Error('Seed Man combat browser server did not start.');
}

async function snapshot(page) {
  return page.evaluate(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.() || null);
}

async function fireAt(page, enemyId, hits) {
  for (let index = 0; index < hits; index += 1) {
    await page.evaluate((id) => {
      const combat = window.__SPROUT_COMBAT_BROWSER__.snapshot();
      const enemy = combat.enemies.find((entry) => entry.id === id);
      if (!enemy) throw new Error(`Missing combat enemy ${id}`);
      const liveEnemy = window.__SPROUT_COMBAT_BROWSER__.snapshot().enemies.find((entry) => entry.id === id);
      player.x = id === 'combat-static-mite' ? 2740 : 800;
      player.y = 410;
      player.vx = 30;
      player.vy = 0;
      player.grounded = true;
      return liveEnemy;
    }, enemyId);
    await page.keyboard.press('j');
    await sleep(420);
  }
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
  await page.waitForFunction(() => typeof player !== 'undefined' && Boolean(player));
  await page.addScriptTag({ url: './combat-browser-v1.js' });
  await page.waitForFunction(() => window.__SPROUT_COMBAT_BROWSER__?.snapshot?.()?.installed === true);

  assert.equal((await page.locator('#combat-weapon-count').innerText()).trim(), 'Seed Slinger');
  assert.equal((await page.locator('#combat-phenotype-count').innerText()).trim(), 'None');
  await page.locator('[data-combat="attack"]').waitFor({ state: 'visible' });
  await page.locator('[data-combat="ability"]').waitFor({ state: 'visible' });

  let combat = await snapshot(page);
  assert.equal(combat.enemies.length, 6);
  assert.equal(combat.defeated, 0);

  await fireAt(page, 'combat-aphid-01', 2);
  combat = await snapshot(page);
  assert.equal(combat.enemies.find((enemy) => enemy.id === 'combat-aphid-01').defeated, true, 'Seed Slinger should defeat the first authored enemy.');
  assert.ok(combat.resources.resin >= 2, 'Defeated enemies should award resources.');

  await fireAt(page, 'combat-static-mite', 4);
  combat = await snapshot(page);
  assert.equal(combat.enemies.find((enemy) => enemy.id === 'combat-static-mite').defeated, true, 'Elite phenotype carrier should be defeatable with weapon fire.');
  assert.equal(combat.activePhenotype, 'static-haze');
  assert.ok(combat.discoveredPhenotypes.includes('static-haze'));
  assert.match((await page.locator('#combat-phenotype-count').innerText()).trim(), /Static Haze/i);

  await page.keyboard.press('k');
  await sleep(50);
  combat = await snapshot(page);
  assert.ok(combat.projectiles.some((projectile) => projectile.ability && projectile.effect === 'chain'), 'Acquired Static Haze should fire a chain-lightning phenotype projectile.');

  assert.equal(errors.length, 0, `Browser combat errors: ${errors.join(' | ')}`);
  console.log('Seed Man browser combat, authored enemies, resources, and phenotype acquisition passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
